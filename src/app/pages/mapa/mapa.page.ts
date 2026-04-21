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
  pois: Poi[] = [];
  filteredPois: Poi[] = [];
  selectedPoi: Poi | null = null;
  currentFilter = 'Todos';

  constructor(
    private poiService: PoiService,
    private modalCtrl: ModalController
  ) {}

  ngOnInit() {}

  ionViewWillEnter() {
    this.cargarPois();
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

  abrirPoiModal(poi: Poi) {
    console.log('POI recibido en MapaPage:', poi.name);
    this.selectedPoi = poi;
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