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
  routeSearch = '';

  isLoadingRoutes = false;
  isLoadingCustomRoutes = false;
  deletingRouteId: string | null = null;
  routesError = '';
  customRoutesError = '';
  fallbackImage = 'assets/icon/logo-nexo.png';

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
    this.routesError = '';

    this.routeService.getAllRoutes().subscribe({
      next: (routes) => {
        this.routes = routes;
        this.isLoadingRoutes = false;
      },
      error: (error) => {
        console.error('Error cargando rutas generales:', error);
        this.isLoadingRoutes = false;
        this.routesError = 'No se pudieron cargar las rutas recomendadas. Revisa tu conexión.';
      }
    });
  }

  loadCustomRoutes() {
    this.isLoadingCustomRoutes = true;
    this.customRoutesError = '';

    this.routeService.getCustomRoutes().subscribe({
      next: (customRoutes) => {
        this.customRoutes = customRoutes;
        this.isLoadingCustomRoutes = false;
      },
      error: (error) => {
        console.error('Error cargando rutas personalizadas:', error);
        this.isLoadingCustomRoutes = false;
        this.customRoutesError = 'No se pudieron cargar tus rutas personalizadas. Revisa tu conexión.';
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

  trackByRouteId(index: number, route: Route | CustomRoute): string {
    return route.id;
  }

  get filteredRecommendedRoutes(): Route[] {
    const term = this.routeSearch.toLocaleLowerCase('es').trim();
    if (!term) {
      return this.routes;
    }
    return this.routes.filter(route =>
      [route.name, route.description, route.duration]
        .some(value => (value || '').toLocaleLowerCase('es').includes(term))
    );
  }

  get totalCustomStops(): number {
    return this.customRoutes.reduce(
      (total, route) => total + (route.route_places?.length || 0),
      0
    );
  }

  get totalRecommendedPlaces(): number {
    return this.routes.reduce(
      (total, route) => total + this.getPoisForRoute(route.id).length,
      0
    );
  }

  routeCategoryFor(routeId: string): string {
    return this.getPoisForRoute(routeId)[0]?.category?.name || 'Ruta';
  }

  coverForRoute(routeId: string): string {
    return this.getPoisForRoute(routeId).find(poi => !!poi.image)?.image
      || this.fallbackImage;
  }

  coverForCustomRoute(route: CustomRoute): string {
    return route.route_places.find(place => !!place.place_image)?.place_image
      || this.fallbackImage;
  }

  clearRouteSearch(): void {
    this.routeSearch = '';
  }

  goToMap(): void {
    this.router.navigate(['/tabs/map']);
  }

  exploreRouteOnMap(route: Route, event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/tabs/map'], {
      queryParams: {
        routeId: route.id,
        routeName: route.name
      }
    });
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