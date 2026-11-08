import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  ModalController,
  AlertController
} from '@ionic/angular/standalone';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { LeafletMapComponent } from '../../components/leaflet-map/leaflet-map.component';
import { PoiService } from 'src/app/services/poi/poi.service';
import {
  RouteService,
  CustomRoute
} from 'src/app/services/route/route.service';
import { GamificationService } from 'src/app/services/gamification/gamification.service';
import { Poi } from 'src/app/models/poi.model';
import { PoiModalComponent } from 'src/app/components/poi-modal/poi-modal.component';
import { MapPoint, MapStyle, TravelMode } from 'src/app/services/map-routing.service';
import { RoutePresentation } from 'src/app/components/leaflet-map/leaflet-map.component';

@Component({
  selector: 'app-mapa',
  templateUrl: './mapa.page.html',
  styleUrls: ['./mapa.page.scss'],
  standalone: true,
  imports: [IonContent, CommonModule, FormsModule, LeafletMapComponent]
})
export class MapaPage implements OnInit, OnDestroy {
  @ViewChild(LeafletMapComponent) leafletMap?: LeafletMapComponent;

  pois: Poi[] = [];
  filteredPois: Poi[] = [];
  selectedPoi: Poi | null = null;
  currentFilter = 'Todos';

  travelMode: TravelMode = 'car';
  mapStyle: MapStyle = 'street';
  myCoordinates: MapPoint | null = null;
  myAccuracy: number | null = null;
  isLocating = false;
  pickLocationMode = false;
  startFromMyLocation = false;
  locationNotice = '';
  routePresentation: RoutePresentation = {
    distanceKm: null, durationMinutes: null, isEstimated: false, note: ''
  };
  searchText = '';

  get visiblePoisCount(): number { return this.filteredPois.length; }
  get selectedOrigin(): MapPoint | null {
    if (this.assistantOrigin) return this.assistantOrigin;
    return this.startFromMyLocation && this.myCoordinates && this.routePoisToDisplay.length
      ? this.myCoordinates : null;
  }

  onRouteInfo(info: RoutePresentation): void {
    this.routePresentation = info;
  }

  changeTravelMode(mode: TravelMode): void {
    this.travelMode = mode;
    this.isRouteOptimized = false;
  }

  changeMapStyle(style: MapStyle): void {
    this.mapStyle = style;
  }

  async locateMe(): Promise<void> {
    if (this.isLocating) return;
    this.isLocating = true;
    this.pickLocationMode = false;
    this.locationNotice = 'Consultando tu ubicación…';

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocalización no disponible en este navegador.'));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false, timeout: 20000, maximumAge: 60000
        });
      });
      this.myCoordinates = [pos.coords.latitude, pos.coords.longitude];
      this.myAccuracy = pos.coords.accuracy;
      this.locationNotice = 'Ubicación aproximada obtenida. Precisión: ±' +
        Math.round(pos.coords.accuracy) + ' m.';
      setTimeout(() => this.leafletMap?.centrarUbicacion(), 100);
    } catch (error: unknown) {
      const geo = error as { code?: number; message?: string };
      const description = geo.code === 1
        ? 'El dispositivo o navegador rechazó la ubicación. Usa «Elegir en el mapa».'
        : geo.code === 3
          ? 'El GPS tardó demasiado. Intenta otra vez o elige un punto en el mapa.'
          : 'No se pudo determinar la ubicación. Puedes elegirla manualmente en el mapa.';
      this.locationNotice = description;
    } finally {
      this.isLocating = false;
    }
  }

  enableLocationPicking(): void {
    this.pickLocationMode = !this.pickLocationMode;
    this.locationNotice = this.pickLocationMode
      ? 'Selecciona un punto del mapa. Se utilizará como referencia, no como GPS real.'
      : '';
  }

  onLocationPicked(coords: MapPoint): void {
    this.myCoordinates = coords;
    this.myAccuracy = null;
    this.pickLocationMode = false;
    this.locationNotice = 'Ubicación de referencia seleccionada en el mapa.';
    setTimeout(() => this.leafletMap?.centrarUbicacion(), 50);
  }

  clearMyLocation(): void {
    this.myCoordinates = null;
    this.myAccuracy = null;
    this.startFromMyLocation = false;
    this.pickLocationMode = false;
    this.locationNotice = 'Ubicación eliminada del mapa.';
  }

  applySearch(): void {
    this.aplicarFiltro(this.currentFilter);
  }

  private matchesSearch(poi: Poi): boolean {
    const q = this.searchText.toLocaleLowerCase('es').trim();
    if (!q) return true;
    return [poi.name, poi.description, poi.municipality?.name, poi.category?.name]
      .some(item => (item || '').toLocaleLowerCase('es').includes(q));
  }

  moveStop(index: number, direction: number): void {
    const next = index + direction;
    if (!this.isCreatingRoute || next < 0 || next >= this.customRoute.length) return;
    const copy = [...this.customRoute];
    [copy[index], copy[next]] = [copy[next], copy[index]];
    this.customRoute = copy;
    this.isRouteOptimized = false;
    this.actualizarDistanciaRuta();
  }

  isCreatingRoute = false;
  isSavingRoute = false;
  isRouteOptimized = false;
  customRoute: Poi[] = [];
  totalDistanceKm = 0;

  savedRoutes: CustomRoute[] = [];
  selectedSavedRoute: CustomRoute | null = null;
  selectedSavedRoutePois: Poi[] = [];

  assistantNotice = '';
  assistantOrigin: [number, number] | null = null;
  assistantDestination: Poi | null = null;
  assistantBusy = false;
  private pendingAssistant: {type: string; placeId: string; ids: string[]; category: string} | null = null;

  private pendingCustomRouteId: string | null = null;
  private queryParamsSubscription?: Subscription;

  constructor(
    private poiService: PoiService,
    private routeService: RouteService,
    private gamificationService: GamificationService,
    private modalCtrl: ModalController,
    private alertController: AlertController,
    private activatedRoute: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.queryParamsSubscription = this.activatedRoute.queryParamMap.subscribe(params => {
      const assistant = params.get('assistant');
      if (assistant) {
        this.pendingAssistant = {type: assistant, placeId: params.get('placeId') || '',
          ids: (params.get('placeIds') || '').split(',').filter(Boolean), category: params.get('category') || ''};
        this.aplicarAccionAsistente();
      }
      const customRouteId = params.get('customRouteId');

      if (customRouteId) {
        this.pendingCustomRouteId = customRouteId;
        this.mostrarRutaPendienteSiExiste();
      }
    });
  }

  ionViewWillEnter() {
    this.cargarPois();
    this.cargarRutasGuardadas();
  }

  ionViewWillLeave() {
    this.limpiarRutaActivaSinNavegar();
    this.pickLocationMode = false;
    this.assistantOrigin = null;
    this.assistantDestination = null;
  }

  ionViewDidLeave() {
    this.limpiarRutaActivaSinNavegar();
  }

  ngOnDestroy() {
    this.queryParamsSubscription?.unsubscribe();
  }

  private async aplicarAccionAsistente() {
    if (!this.pendingAssistant || this.pois.length === 0) return;
    const action = this.pendingAssistant;
    this.pendingAssistant = null;
    this.assistantOrigin = null;
    this.assistantDestination = null;
    this.assistantNotice = '';
    this.limpiarRutaActivaSinNavegar();
    this.isCreatingRoute = false;
    this.customRoute = [];
    this.aplicarFiltro('Todos');
    // Se consume una sola vez, incluso con el caché de páginas de Ionic.
    void this.router.navigate([], {relativeTo: this.activatedRoute, queryParams: {}, replaceUrl: true});
    if (action.type === 'filter') {
      this.aplicarFiltro(action.category);
      this.assistantNotice = `Categoría: ${action.category}`;
    } else if (action.type === 'places') {
      this.filteredPois = this.pois.filter(p => action.ids.includes(p.id));
      this.assistantNotice = 'Lugares encontrados por el asistente. Pulsa Todos para restaurar el mapa.';
    } else if (action.type === 'itinerary') {
      this.customRoute = action.ids.map(id => this.pois.find(p => p.id === id)).filter((p): p is Poi => !!p);
      this.isCreatingRoute = true;
      this.isRouteOptimized = false;
      this.actualizarDistanciaRuta();
      this.assistantNotice = 'Recorrido sugerido. Revisa las paradas y los horarios; puedes editarlo y guardarlo.';
    } else if (action.type === 'map') {
      this.toggleRouteCreation();
    } else {
      const poi = this.pois.find(p => p.id === action.placeId);
      if (!poi) { this.assistantNotice = 'El lugar ya no está disponible.'; return; }
      this.selectedPoi = poi;
      if (action.type === 'directions') {
        this.assistantBusy = true;
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            if (!navigator.geolocation) { reject(new Error('Ubicación no disponible')); return; }
            navigator.geolocation.getCurrentPosition(resolve, reject, {enableHighAccuracy: true, timeout: 15000, maximumAge: 60000});
          });
          this.assistantOrigin = [position.coords.latitude, position.coords.longitude];
          this.assistantDestination = poi;
          this.assistantNotice = 'Calculando recorrido por carretera…';
        } catch {
          this.assistantNotice = 'No pude obtener la ubicación. Revisa el permiso y usa HTTPS o localhost.';
        } finally { this.assistantBusy = false; }
      } else {
        this.filteredPois = [poi];
        this.assistantNotice = `Lugar seleccionado: ${poi.name}. Pulsa Ver más para abrir su ficha.`;
      }
    }
  }

  get routePoisToDisplay(): Poi[] {
    if (this.assistantDestination) return [this.assistantDestination];
    if (this.isCreatingRoute) {
      return this.customRoute;
    }

    return this.selectedSavedRoutePois;
  }

  cargarPois() {
    this.poiService.getAll().subscribe({
      next: (pois) => {
        this.pois = pois;
        this.aplicarFiltro(this.currentFilter);
        this.aplicarAccionAsistente();
      },
      error: (err) => {
        console.error('Error cargando POIs:', err);
      }
    });
  }

  cargarRutasGuardadas() {
    this.routeService.getCustomRoutes().subscribe({
      next: (routes) => {
        this.savedRoutes = routes;
        this.mostrarRutaPendienteSiExiste();
      },
      error: (error) => {
        console.error('Error cargando rutas guardadas:', error);
      }
    });
  }

  private mostrarRutaPendienteSiExiste() {
    if (!this.pendingCustomRouteId || this.savedRoutes.length === 0) {
      return;
    }

    const route = this.savedRoutes.find(
      savedRoute => savedRoute.id === this.pendingCustomRouteId
    );

    if (!route) {
      return;
    }

    this.mostrarRutaGuardada(route);
    this.pendingCustomRouteId = null;
  }

  mostrarRutaGuardada(route: CustomRoute) {
    this.assistantOrigin = null;
    this.assistantDestination = null;
    this.isCreatingRoute = false;
    this.customRoute = [];
    this.totalDistanceKm = 0;
    this.isRouteOptimized = false;
    this.selectedPoi = null;

    this.selectedSavedRoute = route;
    this.selectedSavedRoutePois = this.convertCustomRouteToPois(route);

    this.pendingCustomRouteId = null;

    /*
      Se limpia el queryParam para que la ruta no se vuelva a cargar
      cada vez que entres de nuevo al mapa.
      Esto solo se hace al mostrar la ruta, NO al salir del mapa.
    */
    this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: {},
      replaceUrl: true
    });

    setTimeout(() => {
      this.leafletMap?.centrarRuta();
    }, 300);
  }

  limpiarRutaGuardadaSeleccionada() {
    this.selectedSavedRoute = null;
    this.selectedSavedRoutePois = [];
    this.pendingCustomRouteId = null;

    this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: {},
      replaceUrl: true
    });
  }

  private limpiarRutaActivaSinNavegar() {
    this.selectedSavedRoute = null;
    this.selectedSavedRoutePois = [];
    this.pendingCustomRouteId = null;

    if (!this.isCreatingRoute) {
      this.customRoute = [];
      this.totalDistanceKm = 0;
      this.isRouteOptimized = false;
    }
  }

  private convertCustomRouteToPois(customRoute: CustomRoute): Poi[] {
    return customRoute.route_places.map((routePlace) => {
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
          description: customRoute.description || 'Ruta personalizada creada desde NEXO.',
          duration: `${customRoute.route_places.length} parada(s)`
        }
      };
    });
  }

  abrirPoiModal(poi: Poi) {
    if (this.isCreatingRoute) {
      this.agregarPoiARuta(poi);
      return;
    }

    this.selectedPoi = poi;
  }

  agregarPoiARuta(poi: Poi) {
    const yaExiste = this.customRoute.some(item => item.id === poi.id);

    if (yaExiste) {
      this.mostrarAlerta(
        'Lugar repetido',
        'Este lugar ya forma parte de tu ruta personalizada.'
      );
      return;
    }

    this.customRoute.push(poi);
    this.selectedPoi = null;
    this.isRouteOptimized = false;
    this.actualizarDistanciaRuta();
  }

  toggleRouteCreation() {
    this.assistantOrigin = null;
    this.assistantDestination = null;
    this.isCreatingRoute = !this.isCreatingRoute;

    if (this.isCreatingRoute) {
      this.selectedPoi = null;
      this.customRoute = [];
      this.totalDistanceKm = 0;
      this.isRouteOptimized = false;
      this.selectedSavedRoute = null;
      this.selectedSavedRoutePois = [];
      this.pendingCustomRouteId = null;
    } else {
      this.customRoute = [];
      this.totalDistanceKm = 0;
      this.isRouteOptimized = false;
    }
  }

  limpiarRutaPersonalizada() {
    this.customRoute = [];
    this.totalDistanceKm = 0;
    this.isRouteOptimized = false;
  }

  eliminarDeRuta(poiId: string) {
    this.customRoute = this.customRoute.filter(poi => poi.id !== poiId);
    this.isRouteOptimized = false;
    this.actualizarDistanciaRuta();
  }

  optimizarRuta() {
    if (this.customRoute.length < 2) {
      this.mostrarAlerta(
        'Ruta insuficiente',
        'Selecciona al menos dos lugares para optimizar el recorrido.'
      );
      return;
    }

    const validRoute = this.customRoute.filter((poi) => this.getPoiCoordinates(poi) !== null);

    if (validRoute.length < 2) {
      this.mostrarAlerta(
        'Coordenadas incompletas',
        'No hay suficientes lugares con coordenadas válidas para optimizar la ruta.'
      );
      return;
    }

    // Orden estimado por distancia geográfica. No constituye optimización por calles.
    // El componente Leaflet calcula posteriormente el recorrido sobre la red vial.
    this.customRoute = this.getOptimizedRoute(validRoute);
    this.isRouteOptimized = true;
    this.actualizarDistanciaRuta();

    setTimeout(() => {
      this.leafletMap?.centrarRuta();
    }, 250);
  }

  private getOptimizedRoute(route: Poi[]): Poi[] {
    if (route.length <= 8) {
      return this.getExactShortestRoute(route);
    }

    return this.getGreedyShortestRoute(route);
  }

  private getExactShortestRoute(route: Poi[]): Poi[] {
    const permutations = this.getPermutations(route);
    let bestRoute = permutations[0];
    let bestDistance = this.calculateRouteDistance(bestRoute);

    permutations.forEach((candidateRoute) => {
      const distance = this.calculateRouteDistance(candidateRoute);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestRoute = candidateRoute;
      }
    });

    return bestRoute;
  }

  private getGreedyShortestRoute(route: Poi[]): Poi[] {
    let bestRoute: Poi[] = [];
    let bestDistance = Number.POSITIVE_INFINITY;

    route.forEach((startPoi) => {
      const remaining = route.filter(poi => poi.id !== startPoi.id);
      const candidateRoute: Poi[] = [startPoi];

      while (remaining.length > 0) {
        const currentPoi = candidateRoute[candidateRoute.length - 1];

        let nearestIndex = 0;
        let nearestDistance = Number.POSITIVE_INFINITY;

        remaining.forEach((candidatePoi, index) => {
          const distance = this.calculateDistanceBetweenPois(currentPoi, candidatePoi);

          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = index;
          }
        });

        const [nearestPoi] = remaining.splice(nearestIndex, 1);
        candidateRoute.push(nearestPoi);
      }

      const candidateDistance = this.calculateRouteDistance(candidateRoute);

      if (candidateDistance < bestDistance) {
        bestDistance = candidateDistance;
        bestRoute = candidateRoute;
      }
    });

    return bestRoute;
  }

  private getPermutations(items: Poi[]): Poi[][] {
    if (items.length <= 1) {
      return [items];
    }

    const result: Poi[][] = [];

    items.forEach((item, index) => {
      const rest = [
        ...items.slice(0, index),
        ...items.slice(index + 1)
      ];

      const restPermutations = this.getPermutations(rest);

      restPermutations.forEach((permutation) => {
        result.push([item, ...permutation]);
      });
    });

    return result;
  }

  private actualizarDistanciaRuta() {
    this.totalDistanceKm = this.calculateRouteDistance(this.customRoute);
  }

  private calculateRouteDistance(route: Poi[]): number {
    if (route.length < 2) {
      return 0;
    }

    let total = 0;

    for (let i = 0; i < route.length - 1; i++) {
      total += this.calculateDistanceBetweenPois(route[i], route[i + 1]);
    }

    return Number(total.toFixed(2));
  }

  private calculateDistanceBetweenPois(a: Poi, b: Poi): number {
    const coordsA = this.getPoiCoordinates(a);
    const coordsB = this.getPoiCoordinates(b);

    if (!coordsA || !coordsB) {
      return 0;
    }

    return this.haversineDistanceKm(
      coordsA.lat,
      coordsA.lng,
      coordsB.lat,
      coordsB.lng
    );
  }

  private getPoiCoordinates(poi: Poi): { lat: number; lng: number } | null {
    const lat = parseFloat(poi.latitude);
    const lng = parseFloat(poi.longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return null;
    }

    return { lat, lng };
  }

  private haversineDistanceKm(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const earthRadiusKm = 6371;

    const dLat = this.degreesToRadians(lat2 - lat1);
    const dLng = this.degreesToRadians(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.degreesToRadians(lat1)) *
      Math.cos(this.degreesToRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadiusKm * c;
  }

  private degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  async finalizarRuta() {
    if (this.customRoute.length === 0) {
      await this.mostrarAlerta(
        'Ruta vacía',
        'Agrega al menos un lugar para poder guardar tu ruta personalizada.'
      );
      return;
    }

    if (this.customRoute.length < 2) {
      await this.mostrarAlerta(
        'Ruta incompleta',
        'Agrega al menos dos lugares para guardar una ruta turística.'
      );
      return;
    }

    if (this.isSavingRoute) {
      return;
    }

    if (!this.isRouteOptimized) {
      this.optimizarRuta();
    }

    const alert = await this.alertController.create({
      header: 'Guardar recorrido',
      message: `La ruta contiene ${this.customRoute.length} paradas. La estimación en línea recta es de ${this.totalDistanceKm} km; la distancia real puede ser mayor. El perfil de desplazamiento no se guarda todavía en la base de datos.`,
      inputs: [
        {
          name: 'name',
          type: 'text',
          placeholder: 'Ej. Ruta cultural optimizada',
          attributes: {
            maxlength: 100
          }
        },
        {
          name: 'description',
          type: 'textarea',
          placeholder: 'Descripción opcional de la ruta'
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Guardar',
          handler: (data) => {
            const routeName = (data.name || '').trim();
            const description = (data.description || '').trim();

            if (!routeName) {
              this.mostrarAlerta(
                'Nombre requerido',
                'Escribe un nombre para guardar la ruta.'
              );
              return false;
            }

            this.guardarRutaPersonalizada(routeName, description);
            return true;
          }
        }
      ]
    });

    await alert.present();
  }

  private guardarRutaPersonalizada(name: string, description: string) {
    this.isSavingRoute = true;

    const placeIds = this.customRoute.map(poi => poi.id);

    this.routeService.createCustomRoute({
      name,
      description,
      places: placeIds
    }).subscribe({
      next: (customRoute) => {
        console.log('Ruta personalizada guardada:', customRoute);

        this.gamificationService.awardPoints('custom_route', customRoute.id).subscribe({
          next: () => {
            console.log('Puntos otorgados por crear ruta personalizada');
          },
          error: (error: unknown) => {
            console.error('Error al otorgar puntos por ruta personalizada:', error);
          }
        });

        this.isSavingRoute = false;
        this.isCreatingRoute = false;
        this.customRoute = [];
        this.totalDistanceKm = 0;
        this.isRouteOptimized = false;
        this.cargarRutasGuardadas();

        this.mostrarAlerta(
          'Ruta guardada',
          'Tu recorrido fue guardado. La modalidad y el trazado deberán volver a calcularse al abrirlo.'
        );
      },
      error: (error: unknown) => {
        console.error('Error al guardar ruta personalizada:', error);

        this.isSavingRoute = false;

        this.mostrarAlerta(
          'Error',
          'No se pudo guardar la ruta personalizada. Inténtalo nuevamente.'
        );
      }
    });
  }

  async abrirDetalleCompleto(poi: Poi, event?: Event) {
    if (event) {
      (event.target as HTMLElement)?.blur();
    }

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
    await modal.onDidDismiss();
  }

  aplicarFiltro(tipo: string) {
    this.currentFilter = tipo;

    if (tipo === 'Todos') {
      this.filteredPois = this.pois.filter(p => this.matchesSearch(p));
    } else {
      this.filteredPois = this.pois.filter(
        (poi) => (poi.category?.name || '').toLowerCase() === tipo.toLowerCase() &&
          this.matchesSearch(poi)
      );
    }

    this.selectedPoi = null;
  }

  cerrarPreview() {
    this.selectedPoi = null;
  }

  private async mostrarAlerta(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['Aceptar']
    });

    await alert.present();
  }
}