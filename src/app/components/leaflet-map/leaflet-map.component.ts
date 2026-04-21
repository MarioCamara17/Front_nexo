import { Component, OnInit, Input, OnChanges, SimpleChanges, Output, EventEmitter, NgZone } from '@angular/core';
import * as L from 'leaflet';
import { Poi } from 'src/app/models/poi.model';
import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

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
  @Output() poiClicked = new EventEmitter<Poi>();

  map: L.Map | undefined;
  private markers: L.Marker[] = [];
  mapInitialized = false;

  constructor(private ngZone: NgZone) {}

  ngOnInit() {
    setTimeout(() => {
      this.map = L.map('mapId', {
        zoomControl: true
      }).setView([17.8409, -92.6189], 8);

      L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(this.map!);

      this.mapInitialized = true;

      if (this.pois.length > 0) {
        this.addMarkers();
      }

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

  private addMarkers() {
    if (!this.map) return;

    this.pois.forEach((poi) => {
      const lat = parseFloat(poi.latitude);
      const lng = parseFloat(poi.longitude);

      if (isNaN(lat) || isNaN(lng)) {
        console.warn('POI con coordenadas inválidas:', poi.name, poi.latitude, poi.longitude);
        return;
      }

      const marker = L.marker([lat, lng], {
        icon: this.getIconByCategory(poi)
      }).addTo(this.map!);

      marker.bindTooltip(
        `
        <div style="text-align:center;">
          <strong>${poi.name}</strong><br>
          <small>${poi.category.name || 'Turismo'}</small><br>
          ⭐ +50 pts
        </div>
        `,
        {
          direction: 'top',
          offset: [0, -20]
        }
      );

      marker.on('click', () => {
        console.log('Pin clickeado:', poi.name);
        this.ngZone.run(() => {
          this.poiClicked.emit(poi);
        });
      });

      marker.on('touchend', () => {
        console.log('Pin tocado:', poi.name);
        this.ngZone.run(() => {
          this.poiClicked.emit(poi);
        });
      });

      this.markers.push(marker);
    });

    if (this.markers.length > 0) {
      const group = L.featureGroup(this.markers);
      this.map.fitBounds(group.getBounds(), { padding: [30, 30] });
    }
  }

  private clearMarkers() {
    if (!this.map) return;

    this.markers.forEach((marker) => this.map?.removeLayer(marker));
    this.markers = [];
  }
}