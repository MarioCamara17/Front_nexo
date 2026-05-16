import {
  Component,
  OnInit,
  Input,
  OnChanges,
  SimpleChanges,
  Output,
  EventEmitter,
  NgZone
} from '@angular/core';
import * as L from 'leaflet';
import { Poi } from 'src/app/models/poi.model';
import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

interface OsrmRouteResponse {
  code: string;
  message?: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: {
      type: string;
      coordinates: [number, number][];
    };
  }>;
}

@Component({
  selector: 'app-leaflet-map',
  templateUrl: './leaflet-map.component.html',
  styleUrls: ['./leaflet-map.component.scss'],
  standalone: true,
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class LeafletMapComponent implements OnInit, OnChanges {
  @Input() pois: Poi[] = [];
  @Input() routePois: Poi[] = [];

  @Output() poiClicked = new EventEmitter<Poi>();

  map: L.Map | undefined;

  private markers: L.Marker[] = [];
  private routeLine: L.Polyline | null = null;
  private routeOrderMarkers: L.Marker[] = [];
  private currentRouteRequest = 0;

  mapInitialized = false;

  constructor(private ngZone: NgZone) {}

  ngOnInit() {
    setTimeout(() => {
      this.map = L.map('mapId', {
        zoomControl: true
      }).setView([17.8409, -92.6189], 8);

      L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(this.map);

      this.mapInitialized = true;

      if (this.pois.length > 0) {
        this.addMarkers();
      }

      this.updateRouteLine();

      setTimeout(() => {
        this.map?.invalidateSize();
      }, 400);
    }, 0);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['pois'] && this.mapInitialized && this.map) {
      this.clearMarkers();
      this.addMarkers();
    }

    if (changes['routePois'] && this.mapInitialized && this.map) {
      this.updateRouteLine();
    }
  }

  private getIconByCategory(_poi: Poi): L.Icon {
    return L.icon({
      iconUrl: 'assets/icon/poi_icon.svg',
      iconRetinaUrl: 'assets/icon/poi_icon.svg',
      shadowUrl: '',
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -30]
    });
  }

  private getPoiCoordinates(poi: Poi): [number, number] | null {
    const lat = parseFloat(poi.latitude);
    const lng = parseFloat(poi.longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return null;
    }

    return [lat, lng];
  }

  private addMarkers() {
    if (!this.map) return;

    this.pois.forEach((poi) => {
      const coords = this.getPoiCoordinates(poi);

      if (!coords) {
        console.warn('POI con coordenadas inválidas:', poi.name, poi.latitude, poi.longitude);
        return;
      }

      const marker = L.marker(coords, {
        icon: this.getIconByCategory(poi)
      }).addTo(this.map!);

      marker.bindTooltip(
        `
        <div style="text-align:center;">
          <strong>${poi.name}</strong><br>
          <small>${poi.category?.name || 'Turismo'}</small><br>
          ⭐ +50 pts
        </div>
        `,
        {
          direction: 'top',
          offset: [0, -20]
        }
      );

      marker.on('click', () => {
        this.ngZone.run(() => {
          this.poiClicked.emit(poi);
        });
      });

      marker.on('touchend', () => {
        this.ngZone.run(() => {
          this.poiClicked.emit(poi);
        });
      });

      this.markers.push(marker);
    });

    if (this.markers.length > 0 && this.routePois.length === 0) {
      const group = L.featureGroup(this.markers);
      this.map.fitBounds(group.getBounds(), { padding: [30, 30] });
    }
  }

  private async updateRouteLine() {
    if (!this.map) return;

    this.clearRouteLine();

    if (!this.routePois || this.routePois.length < 2) {
      return;
    }

    const requestId = ++this.currentRouteRequest;

    const directCoordinates = this.routePois
      .map((poi) => this.getPoiCoordinates(poi))
      .filter((coords): coords is [number, number] => coords !== null);

    if (directCoordinates.length < 2) {
      return;
    }

    try {
      const roadCoordinates = await this.getRoadRouteFromOsrm(directCoordinates);

      if (requestId !== this.currentRouteRequest) {
        return;
      }

      this.drawRouteLine(roadCoordinates, false);
      this.addRouteOrderMarkers();
      this.fitRouteBounds(roadCoordinates);
    } catch (error) {
      console.warn('No se pudo obtener ruta por carretera. Usando línea directa:', error);

      if (requestId !== this.currentRouteRequest) {
        return;
      }

      this.drawRouteLine(directCoordinates, true);
      this.addRouteOrderMarkers();
      this.fitRouteBounds(directCoordinates);
    }
  }

  private async getRoadRouteFromOsrm(routeCoordinates: [number, number][]): Promise<[number, number][]> {
    const coordinatesForOsrm = routeCoordinates
      .map(([lat, lng]) => `${lng},${lat}`)
      .join(';');

    const url =
      `https://router.project-osrm.org/route/v1/driving/${coordinatesForOsrm}` +
      `?overview=full&geometries=geojson&steps=false`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`OSRM respondió con estado ${response.status}`);
    }

    const data = (await response.json()) as OsrmRouteResponse;

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error(data.message || 'OSRM no devolvió una ruta válida');
    }

    const geometry = data.routes[0].geometry.coordinates;

    return geometry.map(([lng, lat]) => [lat, lng]);
  }

  private drawRouteLine(routeCoordinates: [number, number][], isFallback: boolean) {
    if (!this.map) return;

    this.routeLine = L.polyline(routeCoordinates, {
      color: isFallback ? '#d97706' : '#0f766e',
      weight: 6,
      opacity: 0.92,
      lineCap: 'round',
      lineJoin: 'round',
      dashArray: isFallback ? '8, 8' : undefined
    }).addTo(this.map);
  }

  private addRouteOrderMarkers() {
    if (!this.map) return;

    this.routePois.forEach((poi, index) => {
      const coords = this.getPoiCoordinates(poi);
      if (!coords) return;

      const orderIcon = L.divIcon({
        className: 'route-order-marker',
        html: `<div>${index + 1}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const orderMarker = L.marker(coords, {
        icon: orderIcon,
        interactive: false
      }).addTo(this.map!);

      this.routeOrderMarkers.push(orderMarker);
    });
  }

  private fitRouteBounds(routeCoordinates: [number, number][]) {
    if (!this.map || routeCoordinates.length < 2) return;

    const bounds = L.latLngBounds(routeCoordinates);

    this.map.fitBounds(bounds, {
      padding: [70, 70],
      maxZoom: 13
    });
  }

  private clearRouteLine() {
    if (!this.map) return;

    if (this.routeLine) {
      this.map.removeLayer(this.routeLine);
      this.routeLine = null;
    }

    this.routeOrderMarkers.forEach((marker) => {
      this.map?.removeLayer(marker);
    });

    this.routeOrderMarkers = [];
  }

  centrarRuta() {
    if (!this.map || !this.routePois || this.routePois.length < 2) return;

    const routeCoordinates = this.routePois
      .map((poi) => this.getPoiCoordinates(poi))
      .filter((coords): coords is [number, number] => coords !== null);

    if (routeCoordinates.length < 2) return;

    this.fitRouteBounds(routeCoordinates);
  }

  private clearMarkers() {
    if (!this.map) return;

    this.markers.forEach((marker) => this.map?.removeLayer(marker));
    this.markers = [];
  }
}