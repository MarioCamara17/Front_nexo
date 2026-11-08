import {
  Component, Input, Output, EventEmitter, OnInit, OnChanges, OnDestroy,
  SimpleChanges, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { Poi } from 'src/app/models/poi.model';
import {
  MapRoutingService, TravelMode, MapStyle, MapPoint, CalculatedRoute
} from 'src/app/services/map-routing.service';

export interface RoutePresentation {
  distanceKm: number | null;
  durationMinutes: number | null;
  isEstimated: boolean;
  note: string;
}

@Component({
  selector: 'app-leaflet-map',
  templateUrl: './leaflet-map.component.html',
  styleUrls: ['./leaflet-map.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class LeafletMapComponent implements OnInit, OnChanges, OnDestroy {
  @Input() pois: Poi[] = [];
  @Input() routePois: Poi[] = [];
  @Input() routeOrigin: MapPoint | null = null;
  @Input() travelMode: TravelMode = 'car';
  @Input() mapStyle: MapStyle = 'street';
  @Input() userCoordinates: MapPoint | null = null;
  @Input() userAccuracy: number | null = null;
  @Output() poiClicked = new EventEmitter<Poi>();
  @Output() routeStatus = new EventEmitter<string>();
  @Output() routeInfo = new EventEmitter<RoutePresentation>();

  map?: L.Map;
  mapInitialized = false;

  private markers: L.Marker[] = [];
  private routeLine: L.Polyline | null = null;
  private routeOrderMarkers: L.Marker[] = [];
  private userMarker: L.CircleMarker | null = null;
  private accuracyCircle: L.Circle | null = null;
  private currentRouteRequest = 0;
  private abortRoute?: AbortController;
  private backgroundLayer?: L.TileLayer;
  private initialFitDone = false;
  private lastRouteCoordinates: MapPoint[] = [];

  constructor(private ngZone: NgZone, private routing: MapRoutingService) {}

  ngOnInit(): void {
    // Ref independiente por componente; evita conflictos con mapas adicionales.
    setTimeout(() => {
      if (this.map) return;
      this.map = L.map('mapId', { zoomControl: false, preferCanvas: true })
        .setView([17.8409, -92.6189], 8);
      L.control.zoom({ position: 'bottomright' }).addTo(this.map);
      L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(this.map);
      this.setBaseLayer();
      this.mapInitialized = true;
      this.addMarkers();
      this.updateLocationMarker();
      void this.updateRouteLine();
      setTimeout(() => this.map?.invalidateSize(), 300);
    }, 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.mapInitialized || !this.map) return;
    if (changes['mapStyle']) this.setBaseLayer();
    if (changes['pois']) {
      this.clearMarkers();
      this.addMarkers();
    }
    if (changes['userCoordinates'] || changes['userAccuracy']) {
      this.updateLocationMarker();
    }
    if (changes['routePois'] || changes['routeOrigin'] || changes['travelMode']) {
      void this.updateRouteLine();
    }
  }

  ngOnDestroy(): void {
    ++this.currentRouteRequest;
    this.abortRoute?.abort();
    this.map?.remove();
    this.map = undefined;
    this.mapInitialized = false;
  }

  private setBaseLayer(): void {
    if (!this.map) return;
    if (this.backgroundLayer) this.map.removeLayer(this.backgroundLayer);
    const isTopo = this.mapStyle === 'terrain';
    this.backgroundLayer = L.tileLayer(
      isTopo
        ? 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: isTopo ? 17 : 19,
        attribution: isTopo
          ? '&copy; OpenStreetMap contributors, SRTM | &copy; OpenTopoMap (CC-BY-SA)'
          : '&copy; OpenStreetMap contributors'
      }
    ).addTo(this.map);
  }

  private getPoiCoordinates(poi: Poi): MapPoint | null {
    const lat = Number(poi.latitude);
    const lon = Number(poi.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) ||
        Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return [lat, lon];
  }

  private addMarkers(): void {
    if (!this.map) return;
    for (const poi of this.pois) {
      const coords = this.getPoiCoordinates(poi);
      if (!coords) continue;

      const icon = L.icon({
        iconUrl: 'assets/icon/poi_icon.svg',
        iconRetinaUrl: 'assets/icon/poi_icon.svg',
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -30]
      });
      const marker = L.marker(coords, { icon }).addTo(this.map);
      // Crear nodos de texto impide insertar HTML no confiable del catálogo.
      const tooltip = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = poi.name;
      const category = document.createElement('small');
      category.textContent = poi.category?.name || 'Turismo';
      tooltip.append(name, document.createElement('br'), category);
      marker.bindTooltip(tooltip, { direction: 'top', offset: [0, -20] });
      marker.on('click', () => this.ngZone.run(() => this.poiClicked.emit(poi)));
      this.markers.push(marker);
    }

    if (!this.initialFitDone && this.markers.length && !this.routePois.length) {
      this.initialFitDone = true;
      const bounds = L.featureGroup(this.markers).getBounds();
      this.map.fitBounds(bounds, { padding: [28, 28], maxZoom: 11 });
    }
  }

  private clearMarkers(): void {
    for (const marker of this.markers) this.map?.removeLayer(marker);
    this.markers = [];
  }

  private updateLocationMarker(): void {
    if (!this.map) return;
    if (this.userMarker) this.map.removeLayer(this.userMarker);
    if (this.accuracyCircle) this.map.removeLayer(this.accuracyCircle);
    this.userMarker = null;
    this.accuracyCircle = null;

    const coords = this.userCoordinates;
    if (!coords) return;
    if (this.userAccuracy && Number.isFinite(this.userAccuracy) && this.userAccuracy > 0) {
      this.accuracyCircle = L.circle(coords, {
        radius: Math.min(this.userAccuracy, 100000),
        color: '#0c83bf',
        fillColor: '#38bdf8',
        fillOpacity: 0.12,
        weight: 1
      }).addTo(this.map);
    }
    this.userMarker = L.circleMarker(coords, {
      radius: 9,
      color: '#ffffff',
      weight: 3,
      fillColor: '#087dcc',
      fillOpacity: 1
    }).addTo(this.map);
    this.userMarker.bindTooltip('Tu ubicación aproximada');
  }

  centrarUbicacion(): void {
    if (this.map && this.userCoordinates) {
      this.map.flyTo(this.userCoordinates, 14, { duration: 0.7 });
    }
  }

  centrarTodos(): void {
    if (!this.map) return;
    const points: MapPoint[] = this.pois
      .map(p => this.getPoiCoordinates(p))
      .filter((p): p is MapPoint => p !== null);
    if (this.userCoordinates) points.push(this.userCoordinates);
    if (points.length) this.map.fitBounds(L.latLngBounds(points), { padding: [35, 35], maxZoom: 11 });
  }

  centrarRuta(): void {
    if (!this.map || this.lastRouteCoordinates.length < 2) return;
    this.fitRouteBounds(this.lastRouteCoordinates);
  }

  private async updateRouteLine(): Promise<void> {
    if (!this.map) return;
    const requestId = ++this.currentRouteRequest;
    this.abortRoute?.abort();
    this.abortRoute = undefined;
    this.clearRouteLine();
    this.lastRouteCoordinates = [];
    this.routeInfo.emit({ distanceKm: null, durationMinutes: null, isEstimated: false, note: '' });

    const stops = this.routePois
      .map(p => this.getPoiCoordinates(p))
      .filter((p): p is MapPoint => p !== null);
    if (this.routeOrigin) stops.unshift(this.routeOrigin);
    if (stops.length < 2) {
      this.routeStatus.emit('');
      return;
    }
    if (stops.length > 12) {
      this.routeStatus.emit('Máximo 12 paradas por consulta. Reduce los puntos para calcular un recorrido.');
      this.drawApproximateLine(stops);
      return;
    }

    this.routeStatus.emit('Calculando recorrido en el modo seleccionado…');
    const controller = new AbortController();
    this.abortRoute = controller;

    try {
      const result: CalculatedRoute = await this.routing.calculate(stops, this.travelMode, controller.signal);
      if (requestId !== this.currentRouteRequest) return;
      this.lastRouteCoordinates = result.coordinates;
      this.routeLine = L.polyline(result.coordinates, {
        color: this.travelMode === 'foot' ? '#8b5cf6' :
               this.travelMode === 'bicycle' ? '#0c82a7' :
               this.travelMode === 'secondary' ? '#b76f0f' : '#0f766e',
        weight: 6, opacity: 0.92, lineCap: 'round', lineJoin: 'round'
      }).addTo(this.map!);
      this.addRouteOrderMarkers();
      this.fitRouteBounds(result.coordinates);
      this.ngZone.run(() => {
        this.routeInfo.emit({
          distanceKm: result.distanceKm,
          durationMinutes: result.durationMinutes,
          isEstimated: false,
          note: result.note
        });
        this.routeStatus.emit(result.note);
      });
    } catch (err) {
      if (requestId !== this.currentRouteRequest) return;
      console.warn('NEXO: no se pudo calcular la ruta:', err);
      this.drawApproximateLine(stops);
      this.ngZone.run(() => {
        const note = 'No hay un recorrido verificable para este perfil. Línea punteada = conexión visual, NO camino transitable ni indicación para navegar.';
        this.routeStatus.emit(note);
        this.routeInfo.emit({
          distanceKm: null, durationMinutes: null, isEstimated: true, note
        });
      });
    }
  }

  private drawApproximateLine(stops: MapPoint[]): void {
    if (!this.map) return;
    this.lastRouteCoordinates = stops;
    this.routeLine = L.polyline(stops, {
      color: '#dc2626', weight: 4, dashArray: '5, 10', opacity: 0.85
    }).addTo(this.map);
    this.addRouteOrderMarkers();
    this.fitRouteBounds(stops);
  }

  private addRouteOrderMarkers(): void {
    if (!this.map) return;
    this.routePois.forEach((poi, index) => {
      const coords = this.getPoiCoordinates(poi);
      if (!coords) return;
      const icon = L.divIcon({
        className: 'route-order-marker',
        html: '<div>' + (index + 1) + '</div>',
        iconSize: [30, 30], iconAnchor: [15, 15]
      });
      this.routeOrderMarkers.push(L.marker(coords, { icon, interactive: false }).addTo(this.map!));
    });
  }

  private fitRouteBounds(points: MapPoint[]): void {
    this.map?.fitBounds(L.latLngBounds(points), {
      padding: [55, 55],
      maxZoom: 14
    });
  }

  private clearRouteLine(): void {
    if (this.routeLine) this.map?.removeLayer(this.routeLine);
    this.routeLine = null;
    for (const marker of this.routeOrderMarkers) this.map?.removeLayer(marker);
    this.routeOrderMarkers = [];
  }
}
