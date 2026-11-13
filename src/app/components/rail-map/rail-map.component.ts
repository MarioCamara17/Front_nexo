import { AfterViewInit, Component, ElementRef, EventEmitter, Input, NgZone, OnChanges, OnDestroy, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { TrainStation } from '../../models/train-station.model';
import { Poi } from '../../models/poi.model';
@Component({
  selector: 'app-rail-map', standalone: true, imports: [CommonModule],
  template: `<div class="map-tools"><button type="button" (click)="overview()">Ver las tres estaciones</button><button type="button" (click)="toggleRail()" [attr.aria-pressed]="railVisible">{{railVisible ? 'Ocultar vías' : 'Mostrar vías'}}</button></div>
    <div #canvas class="rail-canvas" aria-label="Mapa de estaciones y atractivos cercanos"></div>
    <p class="map-note">Estaciones: círculos verdes. Atractivos: círculos dorados. La línea verde punteada solo indica el orden de las estaciones; las vías cartografiadas se muestran en la capa OpenRailwayMap. No muestra trenes en tiempo real.</p>
    <p class="map-error" role="status" *ngIf="tileError">{{tileError}}</p>`,
  styles: [`:host{display:block}.rail-canvas{height:440px;width:100%;border-radius:16px;z-index:0}.map-tools{display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap}.map-tools button{background:white;color:#164d49;border:1px solid #bad7cf;padding:10px 14px;border-radius:9px;cursor:pointer;font:inherit}.map-note,.map-error{font-size:12px;line-height:1.6;color:#526962}.map-error{color:#934910}@media(max-width:600px){.rail-canvas{height:340px}}`]
})
export class RailMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('canvas', {static: true}) canvas!: ElementRef<HTMLDivElement>;
  @Input() stations: TrainStation[] = [];
  @Input() selectedSlug = '';
  @Input() places: Poi[] = [];
  @Output() stationSelected = new EventEmitter<string>();
  @Output() poiSelected = new EventEmitter<Poi>();
  private map?: L.Map;
  private markers?: L.LayerGroup;
  private rail?: L.TileLayer;
  private observer?: ResizeObserver;
  railVisible = true;
  tileError = '';
  constructor(private zone: NgZone) {}
  ngAfterViewInit(): void {
    this.map = L.map(this.canvas.nativeElement, {scrollWheelZoom: false, maxZoom: 19}).setView([17.7, -91.4], 9);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).on('tileerror', () => this.showTileError()).addTo(this.map);
    this.rail = L.tileLayer('https://tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', {
      maxNativeZoom: 19, maxZoom: 19, opacity: .8,
      attribution: 'Vías: <a href="https://www.openrailwaymap.org/">OpenRailwayMap</a> (CC BY-SA)'
    }).on('tileerror', () => this.showTileError()).addTo(this.map);
    this.markers = L.layerGroup().addTo(this.map);
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(() => this.map?.invalidateSize());
      this.observer.observe(this.canvas.nativeElement);
    }
    this.draw(); this.overview();
  }
  ngOnChanges(): void { this.draw(); }
  private showTileError(): void {
    this.zone.run(() => this.tileError = 'No se pudo cargar alguna capa del mapa. Las fichas de estaciones siguen disponibles. Comprueba tu conexión.');
  }
  private draw(): void {
    if (!this.map || !this.markers) return;
    this.markers.clearLayers();
    const stations = [...this.stations].sort((a,b) => a.order-b.order);
    if (stations.length > 1) L.polyline(stations.map(s => [s.latitude, s.longitude] as L.LatLngTuple), {
      color:'#217669', weight:2, dashArray:'6 9', opacity:.65, interactive:false
    }).addTo(this.markers);
    stations.forEach(s => {
      const title = document.createElement('span'); title.textContent = `${s.name}${s.visited ? ' · Visitada' : ''}`;
      L.circleMarker([s.latitude, s.longitude], {radius:s.slug===this.selectedSlug?13:10,color:'#fff',weight:3,fillColor:s.visited?'#236147':'#087f7c',fillOpacity:1})
        .bindTooltip(title).on('click', () => this.zone.run(() => this.stationSelected.emit(s.slug))).addTo(this.markers!);
    });
    this.places.forEach(p => {
      const lat = Number(p.latitude), lng = Number(p.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat)>90 || Math.abs(lng)>180) return;
      const title = document.createElement('span'); title.textContent = p.name;
      L.circleMarker([lat,lng],{radius:7,color:'#6f4b0c',weight:1,fillColor:'#e6bb5d',fillOpacity:1})
        .bindTooltip(title).on('click',()=>this.zone.run(()=>this.poiSelected.emit(p))).addTo(this.markers!);
    });
    const selected = stations.find(s=>s.slug===this.selectedSlug);
    if(selected) this.map.setView([selected.latitude,selected.longitude],11);
  }
  overview(): void {
    if (this.stations.length && this.map) this.map.fitBounds(L.latLngBounds(this.stations.map(s=>[s.latitude,s.longitude] as L.LatLngTuple)),{padding:[35,35],maxZoom:12});
  }
  refresh(): void { this.map?.invalidateSize(); }
  toggleRail(): void {
    this.railVisible=!this.railVisible;
    if(!this.map || !this.rail)return;
    if(this.railVisible)this.rail.addTo(this.map);else this.map.removeLayer(this.rail);
  }
  ngOnDestroy(): void { this.observer?.disconnect();this.map?.remove();this.map=undefined; }
}
