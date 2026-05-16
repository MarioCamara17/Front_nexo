import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  IonContent,
  ModalController,
  IonRefresher,
  IonRefresherContent
} from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { PoiService } from 'src/app/services/poi/poi.service';
import { FavoritesService } from 'src/app/services/favorites/favorites.service';
import { VisitedService } from 'src/app/services/visited/visited.service';
import { Poi } from 'src/app/models/poi.model';
import { Subscription, combineLatest, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { PoiCardComponent } from 'src/app/components/poi-card/poi-card.component';
import { PoiModalComponent } from 'src/app/components/poi-modal/poi-modal.component';

@Component({
  selector: 'app-favoritos',
  templateUrl: './favoritos.page.html',
  styleUrls: ['./favoritos.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    PoiCardComponent,
    CommonModule,
    IonRefresher,
    IonRefresherContent
  ]
})
export class FavoritosPage implements OnInit, OnDestroy {
  favorites: Poi[] = [];
  visitedMap: Record<string, boolean> = {};
  visitDatesMap: Record<string, string> = {};

  private subscriptions: Subscription[] = [];

  constructor(
    private poiService: PoiService,
    private favoriteService: FavoritesService,
    private visitedService: VisitedService,
    private modalCtrl: ModalController
  ) {}

  ngOnInit() {
    this.loadFavorites();
  }

  ionViewWillEnter() {
    this.favoriteService.refresh();
    this.visitedService.refresh();
  }

  loadFavorites() {
    const subscription = combineLatest([
      this.favoriteService.getFavorites(),
      this.visitedService.getVisited(),
      this.visitedService.getVisitDates()
    ])
      .pipe(
        switchMap(([favIds, visitedIds, visitDates]) => {
          this.visitedMap = {};
          this.visitDatesMap = visitDates || {};

          visitedIds.forEach((id) => {
            this.visitedMap[id] = true;
          });

          if (!favIds || favIds.length === 0) {
            this.favorites = [];
            return of([]);
          }

          return this.poiService.getAll();
        })
      )
      .subscribe({
        next: (allPois: Poi[]) => {
          const favoriteIds = this.favoriteServiceSnapshot();

          this.favorites = allPois.filter((poi) =>
            favoriteIds.includes(poi.id)
          );

          console.log('Favoritos cargados con información completa:', this.favorites);
        },
        error: (error) => {
          console.error('Error cargando favoritos:', error);
          this.favorites = [];
        }
      });

    this.subscriptions.push(subscription);
  }

  private favoriteServiceSnapshot(): string[] {
    let snapshot: string[] = [];

    const tempSub = this.favoriteService.getFavorites().subscribe((ids) => {
      snapshot = ids;
    });

    tempSub.unsubscribe();

    return snapshot;
  }

  async openModal(poi: Poi) {
    const modal = await this.modalCtrl.create({
      component: PoiModalComponent,
      componentProps: {
        id: poi.id,
        title: poi.name,
        info: poi.description,
        image: poi.image,
        video: poi.video,
        isRouteContext: false,

        history: poi.history,
        importance: poi.importance,
        recommendations: poi.recommendations,
        schedule: poi.schedule,
        cost: poi.cost,
        tips: poi.tips
      },
      cssClass: 'poi-modal'
    });

    await modal.present();

    const { data } = await modal.onDidDismiss();

    if (data && data.refresh) {
      this.favoriteService.refresh();
      this.visitedService.refresh();
    }
  }

  onRemove(id: string) {
    this.favoriteService.removeFavorite(id).subscribe((success) => {
      if (success) {
        this.favorites = this.favorites.filter((poi) => poi.id !== id);
      }
    });
  }

  toggleVisited(id: string) {
    this.visitedService.toggleVisited(id).subscribe();
  }

  isVisited(id: string): boolean {
    return this.visitedMap[id] || false;
  }

  getVisitDate(id: string): string | null {
    return this.visitDatesMap[id] || null;
  }

  doRefresh(event: any) {
    this.favoriteService.refresh();
    this.visitedService.refresh();

    setTimeout(() => {
      event.target.complete();
    }, 1000);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}