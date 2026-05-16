import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  ModalController,
  AlertController
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';

import {
  RouteService,
  CustomRoute
} from 'src/app/services/route/route.service';

import { Route } from 'src/app/models/route.model';
import { PoiModalComponent } from 'src/app/components/poi-modal/poi-modal.component';
import { Poi } from 'src/app/models/poi.model';
import { PoiService } from 'src/app/services/poi/poi.service';

@Component({
  selector: 'app-rutas',
  templateUrl: './rutas.page.html',
  styleUrls: ['./rutas.page.scss'],
  standalone: true,
  imports: [IonContent, CommonModule, FormsModule]
})
export class RutasPage implements OnInit {
  routes: Route[] = [];
  customRoutes: CustomRoute[] = [];
  pois: Poi[] = [];

  isLoadingRoutes = false;
  isLoadingCustomRoutes = false;
  deletingRouteId: string | null = null;

  constructor(
    private routeService: RouteService,
    private poiService: PoiService,
    private modalCtrl: ModalController,
    private alertController: AlertController,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadData();
  }

  ionViewWillEnter() {
    this.loadCustomRoutes();
  }

  loadData() {
    this.loadRoutes();
    this.loadCustomRoutes();
    this.loadPois();
  }

  loadRoutes() {
    this.isLoadingRoutes = true;

    this.routeService.getAllRoutes().subscribe({
      next: (routes) => {
        this.routes = routes;
        this.isLoadingRoutes = false;
      },
      error: (error) => {
        console.error('Error cargando rutas generales:', error);
        this.isLoadingRoutes = false;
      }
    });
  }

  loadCustomRoutes() {
    this.isLoadingCustomRoutes = true;

    this.routeService.getCustomRoutes().subscribe({
      next: (customRoutes) => {
        this.customRoutes = customRoutes;
        this.isLoadingCustomRoutes = false;
      },
      error: (error) => {
        console.error('Error cargando rutas personalizadas:', error);
        this.isLoadingCustomRoutes = false;
      }
    });
  }

  loadPois() {
    this.poiService.getAll().subscribe({
      next: (pois) => {
        this.pois = pois;
      },
      error: (error) => {
        console.error('Error cargando POIs:', error);
      }
    });
  }

  getPoisForRoute(routeId: string): Poi[] {
    return this.pois.filter(poi => poi.route.id === routeId);
  }

  async openModal(route: Route) {
    const routePois = this.getPoisForRoute(route.id);

    const modal = await this.modalCtrl.create({
      component: PoiModalComponent,
      componentProps: {
        route,
        pois: routePois,
        isRouteContext: true
      },
      cssClass: 'route-modal'
    });

    await modal.present();
  }

  async openCustomRouteModal(customRoute: CustomRoute) {
    const customRoutePois: Poi[] = customRoute.route_places.map((routePlace) => {
      return {
        id: routePlace.place,
        name: routePlace.place_name,
        description: 'Lugar incluido en tu ruta personalizada.',
        history: '',
        importance: '',
        recommendations: '',
        schedule: '',
        cost: '',
        tips: '',
        image: routePlace.place_image,
        video: '',
        latitude: routePlace.place_latitude,
        longitude: routePlace.place_longitude,
        municipality: {
          id: '',
          name: '',
          description: '',
          state: {
            id: '',
            name: '',
            description: ''
          }
        },
        category: {
          id: '',
          name: 'Ruta personalizada',
          description: ''
        },
        route: {
          id: customRoute.id,
          name: customRoute.name,
          description: customRoute.description || 'Ruta personalizada creada desde el mapa de NEXO.',
          duration: `${customRoute.route_places.length} parada(s)`
        }
      };
    });

    const modalRoute: Route = {
      id: customRoute.id,
      name: customRoute.name,
      description: customRoute.description || 'Ruta personalizada creada desde el mapa de NEXO.',
      duration: `${customRoute.route_places.length} parada(s)`
    };

    const modal = await this.modalCtrl.create({
      component: PoiModalComponent,
      componentProps: {
        route: modalRoute,
        pois: customRoutePois,
        isRouteContext: true
      },
      cssClass: 'route-modal'
    });

    await modal.present();
  }

  verRutaEnMapa(route: CustomRoute, event: Event) {
    event.stopPropagation();

    this.router.navigate(['/tabs/map'], {
      queryParams: {
        customRouteId: route.id
      }
    });
  }

  async confirmDeleteCustomRoute(route: CustomRoute, event: Event) {
    event.stopPropagation();

    const alert = await this.alertController.create({
      header: 'Eliminar ruta',
      message: `¿Seguro que quieres eliminar la ruta "${route.name}"? Esta acción no se puede deshacer.`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => {
            this.deleteCustomRoute(route.id);
          }
        }
      ]
    });

    await alert.present();
  }

  private deleteCustomRoute(routeId: string) {
    if (this.deletingRouteId) {
      return;
    }

    this.deletingRouteId = routeId;

    this.routeService.deleteCustomRoute(routeId).subscribe({
      next: () => {
        this.customRoutes = this.customRoutes.filter(route => route.id !== routeId);
        this.deletingRouteId = null;
      },
      error: (error) => {
        console.error('Error eliminando ruta personalizada:', error);
        this.deletingRouteId = null;

        this.showErrorAlert(
          'No se pudo eliminar la ruta. Verifica tu conexión e inténtalo nuevamente.'
        );
      }
    });
  }

  private async showErrorAlert(message: string) {
    const alert = await this.alertController.create({
      header: 'Error',
      message,
      buttons: ['Aceptar']
    });

    await alert.present();
  }

  getCustomRoutePlacesText(customRoute: CustomRoute): string {
    if (!customRoute.route_places || customRoute.route_places.length === 0) {
      return 'Sin lugares registrados';
    }

    return customRoute.route_places
      .map(place => place.place_name)
      .join(' → ');
  }
}