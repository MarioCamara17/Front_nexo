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
  poisLoading = false;
  poisError = '';

  travelMode: TravelMode = 'car';
  mapStyle: MapStyle = 'street';
  myCoordinates: MapPoint | null = null;
  myAccuracy: number | null = null;
  isLocating = false;
  pickLocationMode = false;
  startFromMyLocation = false;
  locationNotice = '';
  routePresentation: RoutePresentation = {
    distanceKm: null, durationMinutes: null, isEstimated: false, note: '', loading: false
  };
  searchText = '';
  showMapOptions = false;

  searchRadiusKm = 5;
  showSearchRadius = true;
  onlyInsideRadius = false;
  nearbyLoading = false;
  nearbyNotice = '';
  radiusPresets = [1, 5, 10, 25, 50, 100];
  nearbyDistances = new Map<string, number>();
  routeFilterId: string | null = null;
  routeFilterName = '';
  pendingLocationReturn: 'chatbot' | null = null;

  get visiblePoisCount(): number { return this.filteredPois.length; }
  get travelModeLabel(): string {
    return this.travelMode === 'foot' ? 'A pie'
      : this.travelMode === 'bicycle' ? 'Bicicleta'
      : this.travelMode === 'secondary' ? 'Caminos secundarios' : 'Automóvil';
  }
  get hasActiveRoute(): boolean {
    return this.routePresentation.loading ||
      this.routePresentation.distanceKm !== null ||
      this.routePresentation.isEstimated;
  }
  get searchCenter(): MapPoint | null { return this.myCoordinates; }
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

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      this.locationNotice = 'El navegador bloquea la ubicación porque NEXO se abrió desde una dirección HTTP de red. Usa http://localhost:8100 en esta computadora o una dirección HTTPS. También puedes usar «Elegir ubicación en el mapa».';
      this.isLocating = false;
      return;
    }

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
      this.refreshRadiusFilter();
      setTimeout(() => this.leafletMap?.centrarRadio(), 120);
    } catch (error: unknown) {
      const geo = error as { code?: number; message?: string };
      const description = geo.code === 1
        ? 'El permiso de ubicación está bloqueado. Pulsa el candado junto a la dirección, permite la ubicación y recarga. También puedes usar «Elegir ubicación en el mapa».'
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
    this.refreshRadiusFilter();
    setTimeout(() => this.leafletMap?.centrarRadio(), 60);
    if (this.pendingLocationReturn === 'chatbot') {
      this.pendingLocationReturn = null;
      void this.router.navigate(['/tabs/chatbot'], {
        queryParams: {
          lat: String(coords[0]),
          lng: String(coords[1]),
          radius: String(this.searchRadiusKm),
          picked: '1'
        }
      });
    }
  }

  clearMyLocation(): void {
    this.myCoordinates = null;
    this.myAccuracy = null;
    this.startFromMyLocation = false;
    this.pickLocationMode = false;
    this.onlyInsideRadius = false;
    this.nearbyDistances.clear();
    this.nearbyNotice = '';
    this.locationNotice = 'Ubicación eliminada del mapa.';
    this.aplicarFiltro(this.currentFilter);
  }

  applySearch(): void {
    this.aplicarFiltro(this.currentFilter);
  }

  onRadiusChange(): void {
    this.searchRadiusKm = this.clampRadius(this.searchRadiusKm);
    this.nearbyNotice = '';
    if (this.onlyInsideRadius) {
      if (!this.myCoordinates) {
        this.onlyInsideRadius = false;
        this.locationNotice = 'Comparte tu ubicación para filtrar los lugares por radio.';
      }
      this.aplicarFiltro(this.currentFilter);
    }
  }

  setRadius(value: number): void {
    this.searchRadiusKm = this.clampRadius(value);
    this.onRadiusChange();
  }

  onOnlyInsideChange(): void {
    if (this.onlyInsideRadius && !this.myCoordinates) {
      this.onlyInsideRadius = false;
      this.locationNotice = 'Comparte tu ubicación para mostrar solo los lugares dentro del radio.';
      return;
    }
    this.aplicarFiltro(this.currentFilter);
    if (this.onlyInsideRadius) {
      this.assistantNotice = `Mostrando lugares dentro de ${this.searchRadiusKm} km ` +
        'en línea recta.';
    }
  }

  detectarLugaresCercanos(): void {
    if (this.nearbyLoading) return;
    if (!this.myCoordinates) {
      this.locationNotice = 'Comparte tu ubicación o elige un punto en el mapa para ' +
        'detectar lugares cercanos.';
      return;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.onlyInsideRadius = true;
      this.aplicarFiltro(this.currentFilter);
      this.nearbyNotice = 'Sin conexión: mostrando lugares calculados localmente dentro de ' +
        `${this.searchRadiusKm} km en línea recta.`;
      return;
    }
    const [latitude, longitude] = this.myCoordinates;
    this.nearbyLoading = true;
    this.nearbyNotice = '';
    this.assistantNotice = '';
    this.poiService.getNearby({
      latitude,
      longitude,
      radius_km: this.searchRadiusKm,
      category: this.currentFilter !== 'Todos' ? this.currentFilter : undefined,
      search: this.searchText.trim() || undefined,
      limit: 100
    }).subscribe({
      next: response => {
        this.nearbyLoading = false;
        this.nearbyDistances = new Map(
          response.results
            .filter(item => typeof item.distance_km === 'number')
            .map(item => [item.id, item.distance_km as number])
        );
        this.onlyInsideRadius = true;
        this.aplicarFiltro(this.currentFilter);
        this.nearbyNotice = `Radio de ${response.radius_km} km: ${response.count} ` +
          'lugar(es) detectado(s) desde el centro de búsqueda.';
        setTimeout(() => this.leafletMap?.centrarRadio(), 100);
      },
      error: () => {
        this.nearbyLoading = false;
        this.onlyInsideRadius = true;
        this.aplicarFiltro(this.currentFilter);
        this.nearbyNotice = 'No se pudo consultar al servidor. Se muestran los lugares ' +
          `calculados localmente dentro de ${this.searchRadiusKm} km.`;
      }
    });
  }

  private clampRadius(value: number): number {
    const number = Number(value);
    if (!Number.isFinite(number)) return 5;
    return Math.min(100, Math.max(1, Math.round(number)));
  }

  private distanceForPoi(poi: Poi): number | null {
    const cached = this.nearbyDistances.get(poi.id);
    if (cached !== undefined) return cached;
    const center = this.myCoordinates;
    if (!center) return null;
    const coordinates = this.getPoiCoordinates(poi);
    if (!coordinates) return null;
    return Number(
      this.haversineDistanceKm(center[0], center[1], coordinates.lat, coordinates.lng).toFixed(2)
    );
  }

  private withDistance(poi: Poi): Poi {
    const distance = this.distanceForPoi(poi);
    return { ...poi, distance_km: distance === null ? undefined : distance };
  }

  private refreshRadiusFilter(): void {
    this.nearbyDistances.clear();
    this.nearbyNotice = '';
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
  routeStatusMessage = '';
  assistantOrigin: [number, number] | null = null;
  assistantDestination: Poi | null = null;
  assistantBusy = false;
  private pendingAssistant: {
    type: string;
    placeId: string;
    ids: string[];
    category: string;
    radius?: number;
    center?: MapPoint | null;
  } | null = null;

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
      const radius = params.get('radius');
      const radiusNumber = Number(radius);
      if (radius !== null && Number.isFinite(radiusNumber) && radiusNumber > 0) {
        this.searchRadiusKm = this.clampRadius(radiusNumber);
      }

      const pick = params.get('pick') === '1';
      const returnTo = params.get('returnTo');
      if (pick) {
        this.pickLocationMode = true;
        this.pendingLocationReturn = returnTo === 'chatbot' ? 'chatbot' : null;
        this.locationNotice = 'Toca el mapa para elegir tu ubicación de referencia.';
      }

      const routeId = params.get('routeId');
      if (routeId) {
        this.routeFilterId = routeId;
        this.routeFilterName = params.get('routeName') || 'ruta seleccionada';
        this.assistantNotice = `Mostrando los lugares de: ${this.routeFilterName}.`;
        this.aplicarFiltro(this.currentFilter);
        void this.router.navigate([], {
          relativeTo: this.activatedRoute,
          queryParams: {},
          replaceUrl: true
        });
      }

      const lat = params.get('lat');
      const lng = params.get('lng');
      const latitude = Number(lat);
      const longitude = Number(lng);
      if (lat !== null && lng !== null &&
          Number.isFinite(latitude) && Number.isFinite(longitude) &&
          Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
        this.myCoordinates = [latitude, longitude];
        this.myAccuracy = null;
        this.locationNotice = 'Ubicación compartida desde el asistente.';
        this.refreshRadiusFilter();
      }

      const assistant = params.get('assistant');
      if (assistant) {
        this.pendingAssistant = {
          type: assistant,
          placeId: params.get('placeId') || '',
          ids: (params.get('placeIds') || '').split(',').filter(Boolean),
          category: params.get('category') || '',
          radius: this.searchRadiusKm,
          center: this.myCoordinates ? [...this.myCoordinates] : null
        };
        void this.aplicarAccionAsistente();
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

    // Intenta ubicar al usuario automáticamente al abrir el mapa.
    // El picking manual sigue disponible como respaldo si el permiso falla.
    if (!this.myCoordinates && !this.pickLocationMode) {
      void this.locateMe();
    }
  }

  ionViewWillLeave() {
    this.limpiarRutaActivaSinNavegar();
    this.pickLocationMode = false;
    this.pendingLocationReturn = null;
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
    if (action.radius) this.searchRadiusKm = this.clampRadius(action.radius);
    if (action.center) {
      this.myCoordinates = action.center;
      this.myAccuracy = null;
      this.locationNotice = 'Ubicación compartida desde el asistente.';
    }
    this.nearbyDistances.clear();
    this.assistantOrigin = null;
    this.assistantDestination = null;
    this.assistantNotice = '';
    this.routeStatusMessage = '';
    this.limpiarRutaActivaSinNavegar();
    this.isCreatingRoute = false;
    this.customRoute = [];
    this.onlyInsideRadius = !!action.center;
    this.aplicarFiltro('Todos');
    // Se consume una sola vez, incluso con el caché de páginas de Ionic.
    void this.router.navigate([], {relativeTo: this.activatedRoute, queryParams: {}, replaceUrl: true});
    if (action.type === 'filter') {
      this.aplicarFiltro(action.category);
      this.assistantNotice = `Categoría: ${action.category}` +
        (this.onlyInsideRadius ? ` · dentro de ${this.searchRadiusKm} km` : '');
    } else if (action.type === 'places') {
      this.filteredPois = this.pois
        .filter(p => action.ids.includes(p.id))
        .map(p => this.withDistance(p));
      this.assistantNotice = `El asistente encontró ${this.filteredPois.length} lugar(es) ` +
        `dentro de ${this.searchRadiusKm} km. Pulsa Todos para restaurar el mapa.`;
      setTimeout(() => this.leafletMap?.centrarRadio(), 150);
    } else if (action.type === 'itinerary') {
      this.onlyInsideRadius = false;
      this.customRoute = action.ids
        .map(id => this.pois.find(p => p.id === id))
        .filter((p): p is Poi => !!p)
        .map(p => this.withDistance(p));
      this.isCreatingRoute = true;
      this.isRouteOptimized = false;
      this.actualizarDistanciaRuta();
      this.assistantNotice = `Recorrido sugerido con ${this.customRoute.length} parada(s) ` +
        `dentro de ${this.searchRadiusKm} km. Revisa las paradas; puedes editarlo y guardarlo.`;
      setTimeout(() => this.leafletMap?.centrarRuta(), 350);
    } else if (action.type === 'map') {
      this.toggleRouteCreation();
    } else {
      const poi = this.pois.find(p => p.id === action.placeId);
      if (!poi) { this.assistantNotice = 'El lugar ya no está disponible.'; return; }
      this.onlyInsideRadius = false;
      const poiWithDistance = this.withDistance(poi);
      this.selectedPoi = poiWithDistance;
      if (action.type === 'directions') {
        this.assistantBusy = true;
        try {
          if (action.center) {
            this.assistantOrigin = action.center;
          } else {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              if (!navigator.geolocation) { reject(new Error('Ubicación no disponible')); return; }
              navigator.geolocation.getCurrentPosition(resolve, reject, {enableHighAccuracy: true, timeout: 15000, maximumAge: 60000});
            });
            this.assistantOrigin = [position.coords.latitude, position.coords.longitude];
            this.myCoordinates = this.assistantOrigin;
            this.myAccuracy = position.coords.accuracy;
            this.locationNotice = 'Ubicación obtenida para trazar el recorrido.';
          }
          this.assistantDestination = poiWithDistance;
          this.assistantNotice = 'Calculando recorrido por carretera…';
        } catch {
          this.assistantNotice = 'No pude obtener la ubicación. Revisa el permiso y usa HTTPS o localhost.';
        } finally { this.assistantBusy = false; }
      } else {
        this.filteredPois = [poiWithDistance];
        this.assistantNotice = `Lugar seleccionado: ${poi.name}. Pulsa Ver más para abrir su ficha.`;
        setTimeout(() => this.leafletMap?.centrarRadio(), 150);
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
    this.poisLoading = true;
    this.poisError = '';
    this.poiService.getAll().subscribe({
      next: (pois) => {
        this.pois = pois;
        this.poisLoading = false;
        this.aplicarFiltro(this.currentFilter);
        void this.aplicarAccionAsistente();
      },
      error: (err) => {
        console.error('Error cargando POIs:', err);
        this.poisLoading = false;
        this.poisError = 'No se pudieron cargar los lugares. Revisa tu conexión e inténtalo de nuevo.';
      }
    });
  }

  clearRouteFilter(): void {
    this.routeFilterId = null;
    this.routeFilterName = '';
    this.assistantNotice = '';
    this.routeStatusMessage = '';
    this.aplicarFiltro(this.currentFilter);
    this.leafletMap?.centrarTodos();
  }

  resetFilters(): void {
    this.searchText = '';
    this.onlyInsideRadius = false;
    this.currentFilter = 'Todos';
    this.routeFilterId = null;
    this.routeFilterName = '';
    this.routeStatusMessage = '';
    this.aplicarFiltro('Todos');
    this.leafletMap?.centrarTodos();
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

  crearRutaConPoi(poi: Poi) {
    if (!this.isCreatingRoute) this.toggleRouteCreation();
    if (!this.customRoute.some(item => item.id === poi.id)) {
      this.customRoute = [...this.customRoute, poi];
    }
    this.selectedPoi = null;
    this.isRouteOptimized = false;
    this.actualizarDistanciaRuta();
    setTimeout(() => this.leafletMap?.centrarRuta(), 250);
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

    // Respetar el orden que seleccionó o ajustó manualmente el visitante.
    // El reordenamiento es voluntario mediante «Ordenar paradas».
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
    let result = this.pois.slice();

    if (this.routeFilterId) {
      result = result.filter(poi => poi.route?.id === this.routeFilterId);
    }
    if (tipo !== 'Todos') {
      result = result.filter(
        (poi) => (poi.category?.name || '').toLowerCase() === tipo.toLowerCase()
      );
    }
    result = result.filter(poi => this.matchesSearch(poi));

    if (this.myCoordinates) {
      result = result.map(poi => this.withDistance(poi));
      if (this.onlyInsideRadius) {
        result = result
          .filter(poi => poi.distance_km !== undefined && poi.distance_km <= this.searchRadiusKm)
          .sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0));
      }
    }

    this.filteredPois = result;
    this.selectedPoi = null;
  }

  openAssistant(): void {
    void this.router.navigate(['/tabs/chatbot'], {
      queryParams: {
        radius: String(this.searchRadiusKm),
        lat: this.myCoordinates ? String(this.myCoordinates[0]) : null,
        lng: this.myCoordinates ? String(this.myCoordinates[1]) : null,
        placeId: this.selectedPoi?.id || null,
        placeName: this.selectedPoi?.name || null
      }
    });
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