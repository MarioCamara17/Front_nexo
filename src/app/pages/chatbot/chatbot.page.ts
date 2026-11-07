import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, IonContent } from '@ionic/angular';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import {
  ChatService,
  ChatResponse,
  ChatAction
} from 'src/app/services/chat.service';

import { PoiService } from 'src/app/services/poi/poi.service';
import { Poi } from 'src/app/models/poi.model';

interface ChatMessage extends ChatResponse {
  role: 'user' | 'bot';
}

@Component({
  selector: 'app-chatbot',
  templateUrl: './chatbot.page.html',
  styleUrls: ['./chatbot.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class ChatbotPage implements OnInit {
  @ViewChild(IonContent) content?: IonContent;

  pois: Poi[] = [];
  placeId = '';
  radius = 5;

  loading = false;
  placesLoading = false;
  placesError = '';

  messages: ChatMessage[] = [
    {
      role: 'bot',
      reply:
        'Hola, soy el asistente de NEXO. Selecciona una pregunta. ' +
        'Para consultar la historia, los datos curiosos, los horarios ' +
        'o cómo llegar, primero elige un lugar de interés.'
    }
  ];

  groups = [
    {
      title: 'Exploración y descubrimiento',
      questions: [
        {
          id: 'nearby',
          label: '¿Qué hay cerca de mi ubicación actual?'
        },
        {
          id: 'popular',
          label: '¿Cuáles son los lugares más destacados o populares?'
        },
        {
          id: 'itinerary',
          label:
            '¿Qué lugares cercanos puedo visitar y cuánto duran sus rutas?'
        }
      ]
    },
    {
      title: 'Historia y cultura',
      questions: [
        {
          id: 'history',
          label: '¿Cuál es la historia de este lugar?'
        },
        {
          id: 'legends',
          label: '¿Existen datos curiosos o leyendas sobre este lugar?'
        }
      ]
    },
    {
      title: 'Rutas y logística',
      questions: [
        {
          id: 'directions',
          label: '¿Cómo llego a este lugar desde donde estoy?'
        },
        {
          id: 'logistics',
          label: '¿Cuáles son los horarios y costos de entrada?'
        }
      ]
    },
    {
      title: 'Ayuda de NEXO',
      questions: [
        {
          id: 'filter',
          label: '¿Cómo puedo filtrar el mapa por categoría?'
        },
        {
          id: 'favorites',
          label: '¿Cómo guardo lugares y recorridos?'
        }
      ]
    }
  ];

  constructor(
    private chatService: ChatService,
    private poiService: PoiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadPlaces();
  }

  loadPlaces(): void {
    if (this.placesLoading) {
      return;
    }

    this.placesLoading = true;
    this.placesError = '';

    this.poiService
      .getAll()
      .pipe(
        finalize(() => {
          this.placesLoading = false;
        })
      )
      .subscribe({
        next: (places) => {
          this.pois = places;

          if (
            this.placeId &&
            !this.pois.some(place => place.id === this.placeId)
          ) {
            this.placeId = '';
          }
        },
        error: () => {
          this.placesError =
            'No se pudieron cargar los lugares. Pulsa Reintentar.';
        }
      });
  }

  async ask(intent: string, label: string): Promise<void> {
    if (this.loading) {
      return;
    }

    const requiresPlace = [
      'history',
      'legends',
      'directions',
      'logistics'
    ].includes(intent);

    if (requiresPlace && !this.placeId) {
      this.addReply({
        reply: 'Primero selecciona un lugar en “Lugar de interés”.'
      });
      return;
    }

    this.messages.push({
      role: 'user',
      reply: label
    });

    this.loading = true;
    this.scrollToBottom();

    const data: Record<string, unknown> = {
      intent,
      radius_km: Number(this.radius)
    };

    if (requiresPlace) {
      data['place_id'] = this.placeId;
    }

    // Ambas preguntas buscan lugares desde la ubicación del visitante.
    if (intent === 'nearby' || intent === 'itinerary') {
      try {
        const position = await this.getLocation();

        data['latitude'] = position.coords.latitude;
        data['longitude'] = position.coords.longitude;
      } catch (error: unknown) {
        this.loading = false;

        this.addReply({
          reply: this.locationErrorMessage(error)
        });

        return;
      }
    }

    this.chatService
      .ask(data)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.scrollToBottom();
        })
      )
      .subscribe({
        next: (response) => {
          this.addReply({
            ...response,
            reply:
              response.reply ||
              'No hay información disponible para esta consulta.'
          });
        },
        error: () => {
          this.addReply({
            reply:
              'No pude completar la consulta. Verifica que el backend ' +
              'esté encendido y que la dirección de la API sea accesible. ' +
              'Después vuelve a intentarlo.'
          });
        }
      });
  }

  private getLocation(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (
        typeof navigator === 'undefined' ||
        !navigator.geolocation
      ) {
        reject(
          new Error('Este dispositivo no permite consultar la ubicación.')
        );
        return;
      }

      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000
        }
      );
    });
  }

  private locationErrorMessage(error: unknown): string {
    const code = (
      error as { code?: number } | null
    )?.code;

    if (code === 1) {
      return (
        'No se autorizó el acceso a tu ubicación. Activa el permiso ' +
        'para NEXO en el navegador y vuelve a intentarlo. ' +
        'En navegador se necesita HTTPS o localhost.'
      );
    }

    if (code === 2) {
      return (
        'Tu ubicación no está disponible. Activa la ubicación del ' +
        'dispositivo y vuelve a intentarlo.'
      );
    }

    if (code === 3) {
      return (
        'Se agotó el tiempo para obtener tu ubicación. ' +
        'Vuelve a intentarlo.'
      );
    }

    return (
      'No pude obtener tu ubicación. Revisa los permisos y utiliza ' +
      'HTTPS o localhost. Puedes consultar los otros temas sin compartirla.'
    );
  }

  private addReply(response: ChatResponse): void {
    this.messages.push({
      ...response,
      role: 'bot'
    });

    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      void this.content?.scrollToBottom(200);
    }, 50);
  }

  action(action: ChatAction): void {
    if (action.type === 'favorites') {
      void this.router.navigate(['/tabs/favorites']);
      return;
    }

    void this.router.navigate(['/tabs/map'], {
      queryParams: {
        assistant: action.type,
        placeId: action.place_id || null,
        placeIds: action.place_ids?.join(',') || null,
        category: action.category || null
      }
    });
  }

  showPlace(placeId: string): void {
    void this.router.navigate(['/tabs/map'], {
      queryParams: {
        assistant: 'place',
        placeId
      }
    });
  }
}