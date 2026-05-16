import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent } from '@ionic/angular/standalone';
import { RouterModule } from '@angular/router';

interface ConnectionZone {
  icon: string;
  name: string;
  description: string;
  tags: string[];
}

interface SuggestedRoute {
  title: string;
  type: string;
  description: string;
  stops: string;
  points: string;
}

interface NearbyPlace {
  icon: string;
  name: string;
  category: string;
  description: string;
}

@Component({
  selector: 'app-tren-maya',
  templateUrl: './tren-maya.page.html',
  styleUrls: ['./tren-maya.page.scss'],
  standalone: true,
  imports: [IonContent, CommonModule, FormsModule, RouterModule]
})
export class TrenMayaPage implements OnInit {
  connectionZones: ConnectionZone[] = [
    {
      icon: '🚉',
      name: 'El Triunfo / Balancán',
      description:
        'Zona estratégica para conectar movilidad ferroviaria con rutas culturales, naturales e históricas de la región Ríos.',
      tags: ['Movilidad', 'Patrimonio', 'Región Ríos']
    },
    {
      icon: '🏛️',
      name: 'Tenosique',
      description:
        'Punto con alto valor turístico por su relación con paisajes ribereños, cultura local y sitios arqueológicos cercanos.',
      tags: ['Cultura', 'Historia', 'Naturaleza']
    },
    {
      icon: '🌿',
      name: 'Corredor turístico regional',
      description:
        'Conexión entre municipios con potencial para crear recorridos temáticos apoyados por geolocalización y contenido digital.',
      tags: ['Rutas', 'Turismo local', 'Experiencias']
    }
  ];

  suggestedRoutes: SuggestedRoute[] = [
    {
      title: 'Ruta cultural desde El Triunfo',
      type: 'Cultural',
      description:
        'Recorrido orientado a sitios históricos, memoria local y patrimonio cultural cercano a zonas de conexión regional.',
      stops: '4 paradas',
      points: '+150 pts'
    },
    {
      title: 'Ruta natural de la Región Ríos',
      type: 'Naturaleza',
      description:
        'Experiencia enfocada en paisajes, ríos, áreas verdes y espacios representativos del entorno natural tabasqueño.',
      stops: '3 paradas',
      points: '+120 pts'
    },
    {
      title: 'Ruta histórica y arqueológica',
      type: 'Historia',
      description:
        'Propuesta para vincular al visitante con zonas arqueológicas, narrativas locales y contexto histórico de Tabasco.',
      stops: '5 paradas',
      points: '+180 pts'
    }
  ];

  nearbyPlaces: NearbyPlace[] = [
    {
      icon: '🏺',
      name: 'Pomoná',
      category: 'Historia',
      description:
        'Sitio arqueológico con valor cultural para fortalecer la interpretación histórica del visitante.'
    },
    {
      icon: '🌊',
      name: 'Río Usumacinta',
      category: 'Naturaleza',
      description:
        'Elemento natural representativo para rutas de paisaje, aventura y conexión territorial.'
    },
    {
      icon: '🏘️',
      name: 'Balancán',
      category: 'Cultura local',
      description:
        'Municipio con potencial para difundir historias, gastronomía, identidad y patrimonio regional.'
    }
  ];

  ngOnInit() {}
}