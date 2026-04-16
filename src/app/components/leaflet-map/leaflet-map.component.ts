import { Component, OnInit, Input, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
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
  mapInitialized: boolean = false;

  constructor() {}

  ngOnInit() {
    setTimeout(() => {
      this.map = L.map('mapId').setView([17.8409, -92.6189], 8);

      L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(this.map);

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
    if (changes['pois']) {
      if (this.mapInitialized && this.map) {
        this.clearMarkers();
        this.addMarkers();
      }
    }
  }

  private getCategoryName(poi: Poi): string {
    return poi.category?.name?.toLowerCase?.() || '';
  }

  private getIconByCategory(poi: Poi): L.Icon {
    const category = this.getCategoryName(poi);

    let iconUrl = 'assets/icon/poi_icon.svg';

    if (category.includes('naturaleza')) {
      iconUrl = 'assets/icon/nature.svg';
    } else if (category.includes('historia')) {
      iconUrl = 'assets/icon/history.svg';
    } else if (category.includes('cultura')) {
      iconUrl = 'assets/icon/culture.svg';
    }

    return L.icon({
      iconUrl,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -30]
    });
  }

  private addMarkers() {
    if (!this.map) return;

    this.pois.forEach(poi => {
      const lat = parseFloat(poi.latitude);
      const lng = parseFloat(poi.longitude);

      if (isNaN(lat) || isNaN(lng)) return;

      const marker = L.marker([lat, lng], {
        icon: this.getIconByCategory(poi)
      }).addTo(this.map!);

      marker.on('click', () => {
        this.poiClicked.emit(poi);
      });

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

      this.markers.push(marker);
    });

    if (this.markers.length > 0) {
      const group = L.featureGroup(this.markers);
      this.map.fitBounds(group.getBounds(), { padding: [30, 30] });
    }
  }

  private clearMarkers() {
    if (!this.map) return;
    this.markers.forEach(marker => this.map!.removeLayer(marker));
    this.markers = [];
  }
}