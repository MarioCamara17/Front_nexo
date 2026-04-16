import { Component, OnInit } from '@angular/core';
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
export class MapaPage implements OnInit {

  // 🔥 TODOS LOS POIS
  pois: Poi[] = [];

  // 🔥 POI SELECCIONADO (para tarjeta inferior)
  selectedPoi: Poi | null = null;

  // 🔥 FILTRO ACTUAL
  currentFilter: string = 'Todos';

  constructor(
    private poiService: PoiService,
    private modalCtrl: ModalController
  ) {}

  ngOnInit() {}

  // 🔄 Se ejecuta cada vez que entras a la página
  ionViewWillEnter() {
    console.log('MapaPage: Cargando POIs...');
    this.cargarPois();
  }

  // 🔥 Cargar POIs
  cargarPois() {
    this.poiService.getAll().subscribe({
      next: (pois) => {
        console.log('POIs cargados:', pois);
        this.pois = pois;
      },
      error: (err) => {
        console.error('Error cargando POIs:', err);
      }
    });
  }

  // 🧠 Selección desde el mapa
  abrirPoiModal(poi: Poi) {
    // 👉 ahora mostramos preview en lugar de abrir directo
    this.selectedPoi = poi;
  }

  // 🔥 Abrir modal manualmente (botón futuro)
  async abrirDetalleCompleto(poi: Poi) {
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
      cssClass: 'poi-modal',
      initialBreakpoint: 0.75,
      breakpoints: [0, 0.75],
      handleBehavior: 'cycle',
    });

    await modal.present();
    await modal.onDidDismiss();
  }

  // 🎯 FILTROS (para Tabasco)
  aplicarFiltro(tipo: string) {
    this.currentFilter = tipo;

    // ⚠️ por ahora solo visual
    // luego aquí filtraremos según categoría real
    console.log('Filtro aplicado:', tipo);
  }

  // ❌ cerrar preview
  cerrarPreview() {
    this.selectedPoi = null;
  }
}