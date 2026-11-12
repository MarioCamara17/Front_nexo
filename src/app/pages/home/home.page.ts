import { Component, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ModalController,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonFab,
  IonFabButton
} from '@ionic/angular/standalone';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { PoiCardComponent } from '../../components/poi-card/poi-card.component';
import { PoiService } from 'src/app/services/poi/poi.service';
import { FavoritesService } from 'src/app/services/favorites/favorites.service';
import { AuthService } from 'src/app/services/auth/auth.service';
import {
  GamificationService,
  GamificationProfile
} from 'src/app/services/gamification/gamification.service';
import { Poi } from 'src/app/models/poi.model';
import { Route } from 'src/app/models/route.model';
import { PoiModalComponent } from 'src/app/components/poi-modal/poi-modal.component';
import { RouteService } from 'src/app/services/route/route.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonFab,
    IonFabButton,
    RouterLink,
    CommonModule,
    PoiCardComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class HomePage implements OnInit, OnDestroy {
  poiList: Poi[] = [];
  routes: Route[] = [];
  isLoading = false;

  gamificationProfile$ = this.gamificationService.profile$;

  private subscriptions: Subscription[] = [];

  constructor(
    private modalCtrl: ModalController,
    private poiService: PoiService,
    private favoritesService: FavoritesService,
    private authService: AuthService,
    private gamificationService: GamificationService,
    private routeService: RouteService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadPois();
    this.loadRoutes();
    this.loadGamification();

    this.subscriptions.push(
      this.authService.isAuthenticated$.subscribe((isAuthenticated: boolean) => {
        if (isAuthenticated) {
          console.log('Usuario autenticado, recargando POIs y gamificación');
          this.loadPois();
          this.loadGamification();
        }
      })
    );

    this.subscriptions.push(
      this.favoritesService.getFavorites().subscribe(() => {
        console.log('Lista de favoritos actualizada');
      })
    );
  }

  ionViewWillEnter() {
    console.log('Home page will enter, checking authentication status');

    if (this.authService.isLoggedIn()) {
      this.favoritesService.refresh();
      this.loadPois();
      this.loadRoutes();
      this.loadGamification();
    }
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  loadPois() {
    this.isLoading = true;

    this.poiService.getAll().subscribe({
      next: (pois: Poi[]) => {
        this.poiList = pois;
        this.isLoading = false;
      },
      error: (error: unknown) => {
        console.error('Error al cargar POIs:', error);
        this.isLoading = false;
      }
    });
  }

  loadGamification() {
    this.gamificationService.loadProfile().subscribe({
      error: (error: unknown) => {
        console.error('Error al cargar gamificación:', error);
      }
    });
  }

  loadRoutes() {
    this.routeService.getAllRoutes().subscribe({
      next: (routes: Route[]) => {
        this.routes = routes;
      },
      error: (error: unknown) => {
        console.error('Error al cargar rutas para inicio:', error);
      }
    });
  }

  getRoutePoiCount(routeId: string): number {
    return this.poiList.filter(poi => poi.route?.id === routeId).length;
  }

  formatDuration(value: string): string {
    if (!value) {
      return '';
    }

    const match = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);

    if (!match) {
      return value;
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);

    if (hours && minutes) {
      return `${hours} h ${minutes} min`;
    }

    if (hours) {
      return `${hours} h`;
    }

    return `${minutes} min`;
  }

  trackByRouteId(index: number, route: Route): string {
    return route.id;
  }
  isCheeseRoute(route: Route): boolean {
    return route.name === 'Ruta del Queso de Poro de Balancán';
  }

  openRouteInMap(route: Route): void {
    this.router.navigate(['/tabs/map'], {
      queryParams: {
        routeId: route.id,
        routeName: route.name,
        category: this.isCheeseRoute(route) ? 'Gastronomía' : undefined
      }
    });
  }
  doRefresh(event: any) {
    this.favoritesService.refresh();

    this.poiService.getAll().subscribe({
      next: (pois: Poi[]) => {
        this.poiList = pois;

        this.gamificationService.loadProfile().subscribe({
          next: () => {
            event.target.complete();
          },
          error: (error: unknown) => {
            console.error('Error al recargar gamificación:', error);
            event.target.complete();
          }
        });
      },
      error: (error: unknown) => {
        console.error('Error al recargar POIs:', error);
        event.target.complete();
      }
    });
  }

  async openModal(poi: Poi) {
    try {
      const modal = await this.modalCtrl.create({
        component: PoiModalComponent,
        componentProps: {
          id: poi.id,
          title: poi.name,
          info: poi.description,
          image: poi.image,
          video: poi.video,
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
        this.loadPois();
        this.loadGamification();
      }
    } catch (error) {
      console.error('Error al abrir el modal:', error);
    }
  }

  getLevelText(profile: GamificationProfile): string {
    return profile.level || 'Visitante inicial';
  }

  getProgressLabel(profile: GamificationProfile): string {
    if (profile.next_level_points === null) {
      return 'Nivel máximo alcanzado';
    }

    return `Progreso hacia ${this.getNextLevelName(profile.points)}`;
  }

  getNextLevelName(points: number): string {
    if (points < 100) {
      return 'Explorador novato';
    }

    if (points < 300) {
      return 'Rastreador cultural';
    }

    if (points < 600) {
      return 'Guía regional';
    }

    if (points < 1000) {
      return 'Maestro explorador';
    }

    return 'Nivel máximo';
  }
}