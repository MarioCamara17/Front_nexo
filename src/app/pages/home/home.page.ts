import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalController, IonContent, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { PoiCardComponent } from '../../components/poi-card/poi-card.component';
import { PoiService } from 'src/app/services/poi/poi.service';
import { FavoritesService } from 'src/app/services/favorites/favorites.service';
import { AuthService } from 'src/app/services/auth/auth.service';
import { Poi } from 'src/app/models/poi.model';
import { Subscription } from 'rxjs';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

// 👇 IMPORT SOLO PARA USO EN MODAL (NO EN imports del componente)
import { PoiModalComponent } from 'src/app/components/poi-modal/poi-modal.component';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    IonContent, 
    IonRefresher, 
    IonRefresherContent, 
    CommonModule, 
    PoiCardComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class HomePage implements OnInit, OnDestroy {
  
  poiList: Poi[] = [];
  isLoading = false;
  private subscriptions: Subscription[] = [];

  constructor(
    private modalCtrl: ModalController,
    private poiService: PoiService,
    private favoritesService: FavoritesService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.loadPois();
    
    this.subscriptions.push(
      this.authService.isAuthenticated$.subscribe(isAuthenticated => {
        if (isAuthenticated) {
          console.log('Usuario autenticado, recargando POIs');
          this.loadPois();
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
    }
  }
  
  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  loadPois() {
    this.isLoading = true;
    this.poiService.getAll().subscribe({
      next: pois => {
        this.poiList = pois;
        this.isLoading = false;
      },
      error: error => {
        console.error('Error al cargar POIs:', error);
        this.isLoading = false;
      }
    });
  }
  
  doRefresh(event: any) {
    this.favoritesService.refresh();
    
    this.poiService.getAll().subscribe({
      next: pois => {
        this.poiList = pois;
        event.target.complete();
      },
      error: error => {
        console.error('Error al recargar POIs:', error);
        event.target.complete();
      }
    });
  }

  async openModal(poi: Poi){
    try {
      const modal = await this.modalCtrl.create({
        component: PoiModalComponent,
        componentProps: {
          id: poi.id,
          title: poi.name,
          info: poi.description,
          image: poi.image,
          video: poi.video
        },
        cssClass: 'poi-modal',
        initialBreakpoint: 0.75,
        breakpoints: [0, 0.75],
        handleBehavior: 'cycle',
      });

      await modal.present();
      const { data } = await modal.onDidDismiss();
      
      if (data && data.refresh) {
        this.loadPois();
      }
    } catch (error) {
      console.error('Error al abrir el modal:', error);
    }
  }
}