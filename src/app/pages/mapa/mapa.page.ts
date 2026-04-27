import { Component, OnInit, OnDestroy } from '@angular/core';
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
  pois: Poi[] = [];
  filteredPois: Poi[] = [];
  selectedPoi: Poi | null = null;
  currentFilter = 'Todos';

  userLocation: { lat: number; lng: number } | null = null;
  locationError = '';
  private watchId: number | null = null;

  // Ruta personalizada
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

  ngOnDestroy() {
    this.detenerSeguimientoUbicacion();
  }

  ionViewDidLeave() {
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

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        this.userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        this.locationError = '';
        console.log('Ubicación actual:', this.userLocation);
      },
      (error) => {
        console.error('Error de geolocalización:', error);
        this.locationError = 'No se pudo obtener tu ubicación actual.';
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000
      }
    );
  }

  detenerSeguimientoUbicacion() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  abrirPoiModal(poi: Poi) {
    if (this.isCreatingRoute) {
      this.agregarPoiARuta(poi);
      return;
    }

    console.log('POI recibido en MapaPage:', poi.name);
    this.selectedPoi = poi;
  }

  agregarPoiARuta(poi: Poi) {
    const yaExiste = this.customRoute.some(item => item.id === poi.id);

    if (yaExiste) {
      return;
    }

    this.customRoute.push(poi);
    this.selectedPoi = null;
    console.log('POI agregado a ruta personalizada:', poi.name);
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
        isRouteContext: false
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