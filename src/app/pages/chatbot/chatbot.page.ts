import {
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { Subscription } from 'rxjs';

import {
  ChatAction,
  ChatPlace,
  ChatRequest,
  ChatResponse,
  ChatService,
  ChatSuggestion
} from 'src/app/services/chat.service';

type ChatRole = 'user' | 'assistant';

interface ChatUiMessage {
  id: string;
  role: ChatRole;
  content: string;
  kind?: string;
  places?: ChatPlace[];
  actions?: ChatAction[];
  suggestions?: ChatSuggestion[];
  meta?: ChatResponse['meta'];
  createdAt: number;
  error?: boolean;
  retryable?: boolean;
  retryText?: string;
}

interface PersistedChat {
  sessionId: string | null;
  radius: number;
  messages: ChatUiMessage[];
}

interface RecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface SpeechWindow {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

@Component({
  selector: 'app-chatbot',
  templateUrl: './chatbot.page.html',
  styleUrls: ['./chatbot.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent]
})
export class ChatbotPage implements OnInit, OnDestroy {
  @ViewChild(IonContent) content?: IonContent;

  readonly radiusPresets = [1, 5, 10, 25, 50, 100];

  readonly quickPrompts: ChatSuggestion[] = [
    { label: '¿Qué hay cerca?', message: '¿Qué hay cerca de mí?' },
    {
      label: 'Imperdibles',
      message: '¿Cuáles son los lugares más destacados?'
    },
    {
      label: 'Plan de un día',
      message: 'Arma un itinerario de un día'
    },
    {
      label: 'Solo naturaleza',
      message: 'Muéstrame solo lugares de naturaleza'
    },
    {
      label: 'Datos curiosos',
      message: '¿Qué datos curiosos hay de Yumká?'
    }
  ];

  messages: ChatUiMessage[] = [];
  draft = '';
  radius = 5;
  sessionId: string | null = null;

  location: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null = null;

  contextPlaceId: string | null = null;
  contextPlaceName: string | null = null;

  typing = false;
  sending = false;
  locationBusy = false;
  showRadiusPanel = false;
  awaitingLocation = false;
  isOnline = true;

  voiceSupported = false;
  speechSupported = false;
  isListening = false;
  autoSpeak = false;
  speakingId: string | null = null;

  notice = '';
  voiceError = '';

  private readonly storageKey = 'nexo.chat.v2';
  private recognition: SpeechRecognitionLike | null = null;
  private lastUserMessage = '';
  private queryParamsSubscription?: Subscription;
  private requestToken = 0;

  private readonly onOnline = () => {
    this.ngZone.run(() => {
      this.isOnline = true;
      this.notice = 'Conexión restablecida. Ya puedes seguir conversando.';
    });
  };

  private readonly onOffline = () => {
    this.ngZone.run(() => {
      this.isOnline = false;
      this.notice =
        'Sin conexión. Tus mensajes están guardados; vuelve a intentarlo ' +
        'cuando recuperes la red.';
    });
  };

  constructor(
    private chatService: ChatService,
    private router: Router,
    private route: ActivatedRoute,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.voiceSupported = this.detectVoiceSupport();
    this.speechSupported =
      typeof window !== 'undefined' && 'speechSynthesis' in window;

    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine;
      window.addEventListener('online', this.onOnline);
      window.addEventListener('offline', this.onOffline);
    }

    this.restoreState();
    this.readQueryContext();

    if (this.messages.length === 0) {
      this.startGreeting();
    } else {
      this.scrollToBottom(false);
    }
  }

  ngOnDestroy(): void {
    ++this.requestToken;
    this.queryParamsSubscription?.unsubscribe();

    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onOnline);
      window.removeEventListener('offline', this.onOffline);
    }

    this.recognition?.abort();
    this.stopSpeaking();
  }

  get locationLabel(): string {
    if (!this.location) {
      return 'Compartir ubicación';
    }

    if (this.location.accuracy) {
      return `Ubicación ±${Math.round(this.location.accuracy)} m`;
    }

    return 'Ubicación activa';
  }

  get hasMessages(): boolean {
    return this.messages.length > 0;
  }

  // ------------------------------------------------------------------
  // Conversación
  // ------------------------------------------------------------------

  send(text?: string): void {
    const content = (text ?? this.draft).trim();

    if (!content || this.sending) {
      return;
    }

    if (!this.isOnline) {
      this.notice =
        'Sin conexión. Tus mensajes están guardados; vuelve a intentarlo ' +
        'cuando recuperes la red.';
      return;
    }

    this.draft = '';
    this.voiceError = '';
    this.messages.push({
      id: this.newId(),
      role: 'user',
      content,
      createdAt: Date.now()
    });
    this.lastUserMessage = content;
    this.persist();
    this.scrollToBottom();
    this.request(content, false);
  }

  retry(message: ChatUiMessage): void {
    if (!message.retryText || this.sending) {
      return;
    }

    this.request(message.retryText, false);
  }

  private request(content: string, addUserMessage: boolean): void {
    if (this.sending) {
      return;
    }

    if (!this.isOnline) {
      this.sending = false;
      this.typing = false;
      this.notice =
        'Sin conexión. Tus mensajes están guardados; vuelve a intentarlo ' +
        'cuando recuperes la red.';
      return;
    }

    if (addUserMessage) {
      this.messages.push({
        id: this.newId(),
        role: 'user',
        content,
        createdAt: Date.now()
      });
      this.lastUserMessage = content;
    }

    const token = ++this.requestToken;
    this.sending = true;
    this.typing = true;
    this.notice = '';

    const payload: ChatRequest = {
      message: content,
      radius_km: this.radius,
      session_id: this.sessionId || undefined,
      context: {
        place_id: this.contextPlaceId || undefined,
        radius_km: this.radius,
        latitude: this.location?.latitude,
        longitude: this.location?.longitude
      }
    };

    if (this.location) {
      payload.latitude = this.location.latitude;
      payload.longitude = this.location.longitude;
    }

    this.scrollToBottom();

    this.chatService.ask(payload).subscribe({
      next: (response) => {
        if (token !== this.requestToken) {
          return;
        }

        this.sending = false;
        this.typing = false;
        this.applyResponseMeta(response);

        const message = this.toAssistantMessage(response);
        this.messages.push(message);
        this.persist();
        this.scrollToBottom();

        if (this.autoSpeak) {
          this.speak(message);
        }
      },
      error: () => {
        if (token !== this.requestToken) {
          return;
        }

        this.sending = false;
        this.typing = false;

        this.messages.push({
          id: this.newId(),
          role: 'assistant',
          content:
            'No pude conectar con el asistente. Revisa tu conexión e ' +
            'inténtalo de nuevo. Tus preguntas anteriores siguen aquí.',
          createdAt: Date.now(),
          error: true,
          retryable: true,
          retryText: content
        });

        this.persist();
        this.scrollToBottom();
      }
    });
  }

  private startGreeting(): void {
    if (this.sending) {
      return;
    }

    if (!this.isOnline) {
      this.messages.push({
        id: this.newId(),
        role: 'assistant',
        content:
          'Hola, soy NEXO. Ahora mismo no hay conexión, pero tus mensajes ' +
          'están guardados. Cuando recuperes la red podré buscar lugares, ' +
          'contarte su historia y armar recorridos.',
        suggestions: this.quickPrompts,
        createdAt: Date.now()
      });
      this.persist();
      this.scrollToBottom(false);
      return;
    }

    const token = ++this.requestToken;
    this.sending = true;
    this.typing = true;

    this.chatService.greet(this.sessionId || undefined).subscribe({
      next: (response) => {
        if (token !== this.requestToken) {
          return;
        }

        this.sending = false;
        this.typing = false;
        this.applyResponseMeta(response);
        this.messages.push(this.toAssistantMessage(response));
        this.persist();
        this.scrollToBottom();
      },
      error: () => {
        if (token !== this.requestToken) {
          return;
        }

        this.sending = false;
        this.typing = false;

        this.messages.push({
          id: this.newId(),
          role: 'assistant',
          content:
            'Hola, soy NEXO, tu guía turístico de Tabasco. 🌿\n\n' +
            'Puedo buscar lugares cerca de ti, recomendarte imperdibles, ' +
            'contarte su historia y armar recorridos. Para empezar, ' +
            'comparte tu ubicación o elige una de las sugerencias.',
          suggestions: this.quickPrompts,
          createdAt: Date.now()
        });

        this.persist();
        this.scrollToBottom();
      }
    });
  }

  private toAssistantMessage(response: ChatResponse): ChatUiMessage {
    return {
      id: this.newId(),
      role: 'assistant',
      content:
        (response.reply || '').trim() ||
        'Listo. ¿Qué más quieres descubrir de Tabasco?',
      kind: response.kind,
      places: response.places || [],
      actions: response.actions || [],
      suggestions: response.suggestions || [],
      meta: response.meta,
      createdAt: Date.now()
    };
  }

  private applyResponseMeta(response: ChatResponse): void {
    if (response.session_id) {
      this.sessionId = response.session_id;
    }

    if (response.context) {
      this.contextPlaceId = response.context.place_id || null;
      this.contextPlaceName = response.context.place_id
        ? response.context.place_name || this.contextPlaceName
        : null;

      if (typeof response.context.radius_km === 'number') {
        this.radius = this.clampRadius(response.context.radius_km);
      }
    }

    if (response.meta) {
      this.awaitingLocation = Boolean(response.meta.requires_location);

      if (typeof response.meta.radius_km === 'number') {
        this.radius = this.clampRadius(response.meta.radius_km);
      }
    }

    if (response.meta?.requires_location && !this.location) {
      this.notice =
        'NEXO necesita tu ubicación para medir el radio de búsqueda.';
    }
  }

  newConversation(): void {
    const previous = this.sessionId;

    ++this.requestToken;
    this.messages = [];
    this.sessionId = null;
    this.contextPlaceId = null;
    this.contextPlaceName = null;
    this.lastUserMessage = '';
    this.typing = false;
    this.sending = false;
    this.draft = '';
    this.notice = '';
    this.voiceError = '';
    this.stopSpeaking();

    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      // El almacenamiento puede estar bloqueado por el navegador.
    }

    if (previous) {
      this.chatService.clearSession(previous).subscribe({
        error: () => undefined
      });
    }

    this.startGreeting();
  }

  // ------------------------------------------------------------------
  // Ubicación y radio
  // ------------------------------------------------------------------

  async shareLocation(): Promise<void> {
    if (this.locationBusy) {
      return;
    }

    this.locationBusy = true;
    this.notice = '';

    try {
      const position = await this.getLocation();

      this.location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      };
      this.locationBusy = false;
      this.notice =
        `Ubicación activa · precisión ±` +
        `${Math.round(position.coords.accuracy)} m.`;

      const pendingQuestion = this.awaitingLocation
        ? this.lastUserMessage
        : '';
      const content = pendingQuestion || '¿Qué hay cerca de mí?';

      this.awaitingLocation = false;

      if (!pendingQuestion) {
        this.messages.push({
          id: this.newId(),
          role: 'user',
          content,
          createdAt: Date.now()
        });
        this.lastUserMessage = content;
        this.persist();
        this.scrollToBottom();
      }

      this.request(content, false);
    } catch (error: unknown) {
      this.locationBusy = false;

      const text = this.locationErrorMessage(error);
      this.notice = text;

      this.messages.push({
        id: this.newId(),
        role: 'assistant',
        content: text,
        createdAt: Date.now(),
        error: true
      });

      this.persist();
      this.scrollToBottom();
    }
  }

  onRadiusChange(): void {
    this.radius = this.clampRadius(this.radius);
    this.persist();
  }

  setRadius(value: number): void {
    this.radius = this.clampRadius(value);
    this.persist();
  }

  searchWithRadius(): void {
    this.showRadiusPanel = false;
    this.send(`Busca lugares en un radio de ${this.radius} km`);
  }

  toggleRadiusPanel(): void {
    this.showRadiusPanel = !this.showRadiusPanel;
  }

  clearPlaceContext(): void {
    this.contextPlaceId = null;
    this.contextPlaceName = null;
  }

  // ------------------------------------------------------------------
  // Acciones de mapa
  // ------------------------------------------------------------------

  action(action: ChatAction): void {
    if (action.type === 'location') {
      void this.shareLocation();
      return;
    }

    if (action.type === 'favorites') {
      void this.router.navigate(['/tabs/favorites']);
      return;
    }

    void this.router.navigate(['/tabs/map'], {
      queryParams: {
        assistant: action.type,
        placeId: action.place_id || null,
        placeIds: action.place_ids?.join(',') || null,
        category: action.category || null,
        radius: String(this.radius),
        lat: this.location ? String(this.location.latitude) : null,
        lng: this.location ? String(this.location.longitude) : null
      }
    });
  }

  showPlace(place: ChatPlace): void {
    void this.router.navigate(['/tabs/map'], {
      queryParams: {
        assistant: 'place',
        placeId: place.id,
        radius: String(this.radius),
        lat: this.location ? String(this.location.latitude) : null,
        lng: this.location ? String(this.location.longitude) : null
      }
    });
  }

  directionsTo(place: ChatPlace): void {
    void this.router.navigate(['/tabs/map'], {
      queryParams: {
        assistant: 'directions',
        placeId: place.id,
        radius: String(this.radius),
        lat: this.location ? String(this.location.latitude) : null,
        lng: this.location ? String(this.location.longitude) : null
      }
    });
  }

  // ------------------------------------------------------------------
  // Voz
  // ------------------------------------------------------------------

  toggleVoice(): void {
    if (this.isListening) {
      this.recognition?.stop();
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    const speechWindow = window as unknown as SpeechWindow;
    const Constructor =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!Constructor) {
      this.voiceError =
        'La entrada por voz no está disponible en este navegador. ' +
        'Puedes escribir tu pregunta.';
      return;
    }

    try {
      const recognition = new Constructor();
      recognition.lang = 'es-MX';
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onresult = (event) => {
        let transcript = '';

        for (let index = event.resultIndex; index < event.results.length; index++) {
          transcript += event.results[index][0]?.transcript || '';
        }

        this.ngZone.run(() => {
          this.draft = transcript.trim();
        });
      };

      recognition.onerror = (event) => {
        this.ngZone.run(() => {
          this.isListening = false;
          this.voiceError =
            event.error === 'not-allowed'
              ? 'No se autorizó el micrófono. Activa el permiso y vuelve a intentarlo.'
              : 'No se pudo usar el micrófono. Puedes escribir tu pregunta.';
        });
      };

      recognition.onend = () => {
        this.ngZone.run(() => {
          this.isListening = false;
        });
      };

      this.recognition = recognition;
      this.isListening = true;
      this.voiceError = '';
      recognition.start();
    } catch {
      this.isListening = false;
      this.voiceError =
        'No se pudo iniciar el micrófono. Puedes escribir tu pregunta.';
    }
  }

  toggleAutoSpeak(): void {
    this.autoSpeak = !this.autoSpeak;

    if (!this.autoSpeak) {
      this.stopSpeaking();
    }

    this.notice = this.autoSpeak
      ? 'Lectura en voz alta activada.'
      : 'Lectura en voz alta desactivada.';
  }

  speak(message: ChatUiMessage): void {
    if (!this.speechSupported || typeof window === 'undefined') {
      return;
    }

    const synth = window.speechSynthesis;

    if (this.speakingId === message.id) {
      synth.cancel();
      this.speakingId = null;
      return;
    }

    synth.cancel();

    const text = this.speechText(message);

    if (!text) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-MX';
    utterance.rate = 1.02;
    utterance.pitch = 1;

    utterance.onend = () => {
      this.ngZone.run(() => {
        if (this.speakingId === message.id) {
          this.speakingId = null;
        }
      });
    };

    utterance.onerror = () => {
      this.ngZone.run(() => {
        if (this.speakingId === message.id) {
          this.speakingId = null;
        }
      });
    };

    this.speakingId = message.id;
    synth.speak(utterance);
  }

  private stopSpeaking(): void {
    if (this.speechSupported && typeof window !== 'undefined') {
      window.speechSynthesis.cancel();
    }

    this.speakingId = null;
  }

  private speechText(message: ChatUiMessage): string {
    const parts = [message.content];

    if (message.places?.length) {
      const names = message.places.slice(0, 3).map((place) => {
        if (place.distance_km !== undefined) {
          return `${place.name} a ${place.distance_km} kilómetros`;
        }
        return place.name;
      });

      parts.push(`Lugares: ${names.join(', ')}`);
    }

    return parts
      .join('. ')
      .replace(/[•*_#]/g, '')
      .slice(0, 1200);
  }

  // ------------------------------------------------------------------
  // Utilidades de la interfaz
  // ------------------------------------------------------------------

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  formatTime(timestamp: number): string {
    try {
      return new Date(timestamp).toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  }

  actionIcon(type: ChatAction['type']): string {
    const icons: Record<ChatAction['type'], string> = {
      map: '🗺️',
      favorites: '⭐',
      filter: '🏷️',
      places: '📍',
      itinerary: '🧭',
      directions: '➤',
      place: '📌',
      location: '📍'
    };

    return icons[type] || '➤';
  }

  imageError(place: ChatPlace): void {
    place.image = null;
  }

  trackMessage(index: number, message: ChatUiMessage): string {
    return message.id || String(index);
  }

  trackPlace(index: number, place: ChatPlace): string {
    return place.id || String(index);
  }

  trackSuggestion(index: number, suggestion: ChatSuggestion): string {
    return `${suggestion.label}-${index}`;
  }

  private scrollToBottom(smooth = true): void {
    setTimeout(() => {
      void this.content?.scrollToBottom(smooth ? 220 : 0);
    }, 70);
  }

  private newId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private clampRadius(value: number): number {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return 5;
    }

    return Math.min(100, Math.max(1, Math.round(number)));
  }

  private detectVoiceSupport(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    const speechWindow = window as unknown as SpeechWindow;
    return Boolean(
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
    );
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
    const code = (error as { code?: number } | null)?.code;

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

  private validCoordinates(latitude: number, longitude: number): boolean {
    return (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      Math.abs(latitude) <= 90 &&
      Math.abs(longitude) <= 180
    );
  }

  // ------------------------------------------------------------------
  // Contexto recibido desde el mapa y persistencia local
  // ------------------------------------------------------------------

  private readQueryContext(): void {
    this.queryParamsSubscription = this.route.queryParamMap.subscribe(
      (params) => {
        const rawRadius = params.get('radius');
        const radius = Number(rawRadius);

        if (rawRadius !== null && Number.isFinite(radius) && radius > 0) {
          this.radius = this.clampRadius(radius);
        }

        const rawLatitude = params.get('lat');
        const rawLongitude = params.get('lng');
        const latitude = Number(rawLatitude);
        const longitude = Number(rawLongitude);

        if (
          rawLatitude !== null &&
          rawLongitude !== null &&
          this.validCoordinates(latitude, longitude)
        ) {
          this.location = {
            latitude,
            longitude
          };
          this.notice = 'Ubicación recibida desde el mapa.';
        }

        const placeId = params.get('placeId');
        const placeName = params.get('placeName');

        if (placeId) {
          this.contextPlaceId = placeId;
        }

        if (placeName) {
          this.contextPlaceName = placeName;
        }

        if (params.keys.length > 0) {
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {},
            replaceUrl: true
          });
        }
      }
    );
  }

  private restoreState(): void {
    try {
      const raw = localStorage.getItem(this.storageKey);

      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as PersistedChat;

      if (parsed && Array.isArray(parsed.messages)) {
        this.messages = parsed.messages
          .filter((message) => this.isValidMessage(message))
          .slice(-24);
      }

      if (typeof parsed.radius === 'number') {
        this.radius = this.clampRadius(parsed.radius);
      }

      if (typeof parsed.sessionId === 'string') {
        this.sessionId = parsed.sessionId;
      }
    } catch {
      // Si el contenido guardado está dañado, se empieza una conversación nueva.
      this.messages = [];
      this.sessionId = null;
    }
  }

  private isValidMessage(message: ChatUiMessage): boolean {
    return Boolean(
      message &&
      (message.role === 'user' || message.role === 'assistant') &&
      typeof message.content === 'string'
    );
  }

  private persist(): void {
    try {
      const payload: PersistedChat = {
        sessionId: this.sessionId,
        radius: this.radius,
        messages: this.messages.slice(-24)
      };

      localStorage.setItem(this.storageKey, JSON.stringify(payload));
    } catch {
      // La conversación sigue funcionando aunque el almacenamiento esté lleno.
    }
  }
}
