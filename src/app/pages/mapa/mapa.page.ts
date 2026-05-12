import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, ModalController } from '@ionic/angular/standalone';

import { LeafletMapComponent } from '../../components/leaflet-map/leaflet-map.component';
import { PoiService } from 'src/app/services/poi/poi.service';
import { Poi } from 'src/app/models/poi.model';
import { PoiModalComponent } from 'src/app/components/poi-modal/poi-modal.component';

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

  userLocation: { lat: number; lng: number } | null = null;
  locationError = '';
  private watchId: number | null = null;

  isCreatingRoute = false;
  customRoute: Poi[] = [];

  constructor(
    private poiService: PoiService,
    private modalCtrl: ModalController
  ) {}

  ngOnInit() {}

  ionViewWillEnter() {
    this.cargarPois();
    this.iniciarSeguimientoUbicacion();
  }

  ionViewDidLeave() {
    this.detenerSeguimientoUbicacion();
  }

  ngOnDestroy() {
    this.detenerSeguimientoUbicacion();
  }

  cargarPois() {
    this.poiService.getAll().subscribe({
      next: (pois) => {
        this.pois = pois;
        this.aplicarFiltro(this.currentFilter);
      },
      error: (err) => {
        console.error('Error cargando POIs:', err);
      }
    });
  }

  iniciarSeguimientoUbicacion() {
    if (!navigator.geolocation) {
      this.locationError = 'Tu navegador no soporta geolocalización.';
      return;
    }

    this.detenerSeguimientoUbicacion();

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        console.log('Ubicación detectada por navegador:', {
          lat,
          lng,
          accuracy: position.coords.accuracy
        });

        if (!this.esUbicacionValidaParaTabasco(lat, lng)) {
          this.locationError =
            'La ubicación detectada parece estar fuera de Tabasco. Verifica permisos, GPS o VPN.';

          console.warn('Ubicación descartada por estar fuera del rango esperado:', {
            lat,
            lng,
            accuracy: position.coords.accuracy
          });

          return;
        }

        this.userLocation = { lat, lng };
        this.locationError = '';

        console.log('Ubicación actual válida:', this.userLocation);
      },
      (error) => {
        console.error('Error de geolocalización:', error);

        if (error.code === error.PERMISSION_DENIED) {
          this.locationError = 'Permiso de ubicación denegado.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          this.locationError = 'La ubicación no está disponible.';
        } else if (error.code === error.TIMEOUT) {
          this.locationError = 'Tiempo agotado al obtener ubicación.';
        } else {
          this.locationError = 'No se pudo obtener tu ubicación actual.';
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 15000
      }
    );
  }

  private esUbicacionValidaParaTabasco(lat: number, lng: number): boolean {
    const latMin = 16.0;
    const latMax = 19.5;
    const lngMin = -94.5;
    const lngMax = -90.0;

    return lat >= latMin && lat <= latMax && lng >= lngMin && lng <= lngMax;
  }

  detenerSeguimientoUbicacion() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  centrarMiUbicacion() {
    this.leafletMap?.centrarEnUbicacionActual();
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
      return;
    }

    this.customRoute.push(poi);
    this.selectedPoi = null;
  }

  toggleRouteCreation() {
    this.isCreatingRoute = !this.isCreatingRoute;

    if (this.isCreatingRoute) {
      this.selectedPoi = null;
    }
  }

  limpiarRutaPersonalizada() {
    this.customRoute = [];
  }

  eliminarDeRuta(poiId: string) {
    this.customRoute = this.customRoute.filter(poi => poi.id !== poiId);
  }

  finalizarRuta() {
    if (this.customRoute.length === 0) {
      return;
    }

    console.log('Ruta personalizada creada:', this.customRoute);
    this.isCreatingRoute = false;
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
      this.filteredPois = [...this.pois];
    } else {
      this.filteredPois = this.pois.filter(
        (poi) => poi.category.name.toLowerCase() === tipo.toLowerCase()
      );
    }

    this.selectedPoi = null;
  }

  cerrarPreview() {
    this.selectedPoi = null;
  }
}