import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { IonContent, ModalController } from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { FavoritesService } from 'src/app/services/favorites/favorites.service';
import { VisitedService } from 'src/app/services/visited/visited.service';
import { Subscription } from 'rxjs';
import { Route } from 'src/app/models/route.model';
import { Poi } from 'src/app/models/poi.model';
import { AuthService } from 'src/app/services/auth/auth.service';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

@Component({
  selector: 'app-poi-modal',
  templateUrl: './poi-modal.component.html',
  styleUrls: ['./poi-modal.component.scss'],
  standalone: true,
  imports: [IonContent, CommonModule, MatIcon],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class PoiModalComponent implements OnInit, OnDestroy {
  @Input() id?: string;
  @Input() title?: string;
  @Input() info?: string;
  @Input() image?: string;
  @Input() video?: string;

  // Información detallada del lugar
  @Input() history?: string;
  @Input() importance?: string;
  @Input() recommendations?: string;
  @Input() schedule?: string;
  @Input() cost?: string;
  @Input() tips?: string;

  @Input() route?: Route;
  @Input() pois?: Poi[];
  @Input() displayMode: 'modal' | 'popup' = 'modal';
  @Input() onPopupClose?: () => void;
  @Input() isRouteContext: boolean = false;

  isSpeaking = false;
  showVideo = false;
  isFav = false;
  isVisited = false;
  visitDate: Date | null = null;
  isProcessingFavorite = false;
  isProcessingVisit = false;

  private favSubscription?: Subscription;
  private visitedSubscription?: Subscription;
  private authSubscription?: Subscription;

  private audioPlayer?: HTMLAudioElement;

  constructor(
    private favoriteService: FavoritesService,
    private visitedService: VisitedService,
    private authService: AuthService,
    private modalCtrl: ModalController,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    console.log('PoiModalComponent ngOnInit, id:', this.id);

    if (this.id) {
      this.favSubscription = this.favoriteService
        .getFavorites()
        .subscribe((favs) => {
          const wasFav = this.isFav;
          this.isFav = favs.includes(this.id!);

          if (wasFav !== this.isFav) {
            this.isProcessingFavorite = false;
          }

          this.cdr.detectChanges();
        });

      this.visitedSubscription = this.visitedService
        .getVisited()
        .subscribe((visited) => {
          const wasVisited = this.isVisited;
          this.isVisited = visited.includes(this.id!);

          if (this.isVisited) {
            this.visitDate = this.visitedService.getVisitDateById(this.id!);
          } else {
            this.visitDate = null;
          }

          if (wasVisited !== this.isVisited) {
            this.isProcessingVisit = false;
          }

          this.cdr.detectChanges();
        });

      this.authSubscription = this.authService.isAuthenticated$.subscribe(isAuthenticated => {
        if (isAuthenticated) {
          console.log('Usuario autenticado, actualizando estado de favoritos y visitas');
        }
      });
    }
  }

  toggleFavorite() {
    if (!this.id || this.isProcessingFavorite) {
      return;
    }

    this.isProcessingFavorite = true;

    this.favoriteService.toggleFavorite(this.id).subscribe({
      next: (success) => {
        if (!success) {
          console.error(`Error al cambiar estado de favorito para ${this.id}`);
          this.isProcessingFavorite = false;
        }
      },
      error: (error) => {
        console.error(`Error al cambiar estado de favorito para ${this.id}:`, error);
        this.isProcessingFavorite = false;
      }
    });
  }

  onVisitedClick(event: Event) {
    event.stopPropagation();
    event.preventDefault();

    if (!this.id || this.isProcessingVisit) {
      return;
    }

    this.isProcessingVisit = true;

    this.visitedService.toggleVisited(this.id).subscribe({
      next: (success) => {
        if (!success) {
          console.error(`Error al cambiar estado de visita para ${this.id}`);
          this.isProcessingVisit = false;
        }
      },
      error: (error) => {
        console.error(`Error al cambiar estado de visita para ${this.id}:`, error);
        this.isProcessingVisit = false;
      }
    });
  }

  onVideoEnded() {
    this.showVideo = false;
  }

  async toggleSpeech() {
    if (this.isSpeaking) {
      await this.stopNarration();
      return;
    }

    const localAudioPath = this.getLocalNarrationAudio();

    if (localAudioPath) {
      this.playLocalAudio(localAudioPath);
      return;
    }

    await this.playFallbackTextToSpeech();
  }

  private getLocalNarrationAudio(): string | null {
    if (this.isRouteContext || !this.title) {
      return null;
    }

    const normalizedTitle = this.normalizeText(this.title);

    if (normalizedTitle.includes('girasol')) {
      return 'assets/audio/girasoles.mp3';
    }

    if (
      normalizedTitle.includes('iglesia') ||
      normalizedTitle.includes('tila') ||
      normalizedTitle.includes('colores')
    ) {
      return 'assets/audio/iglesia-colores.mp3';
    }

    if (
      normalizedTitle.includes('parque central') ||
      normalizedTitle.includes('central de balancan') ||
      normalizedTitle.includes('parque central de balancan')
    ) {
      return 'assets/audio/parque-central.mp3';
    }

    if (
      normalizedTitle.includes('boca del cerro') ||
      normalizedTitle.includes('puente de boca') ||
      normalizedTitle.includes('puente boca')
    ) {
      return 'assets/audio/boca-cerro.mp3';
    }

    return null;
  }

  private normalizeText(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private playLocalAudio(audioPath: string) {
    this.stopLocalAudio();

    TextToSpeech.stop();

    this.audioPlayer = new Audio(audioPath);
    this.audioPlayer.preload = 'auto';

    this.isSpeaking = true;
    this.cdr.detectChanges();

    this.audioPlayer.onended = () => {
      this.isSpeaking = false;
      this.cdr.detectChanges();
    };

    this.audioPlayer.onerror = async () => {
      console.error('No se pudo reproducir el audio local:', audioPath);

      this.isSpeaking = false;
      this.cdr.detectChanges();

      await this.playFallbackTextToSpeech();
    };

    this.audioPlayer.play().catch(async (error) => {
      console.error('Error al iniciar reproducción de audio local:', error);

      this.isSpeaking = false;
      this.cdr.detectChanges();

      await this.playFallbackTextToSpeech();
    });
  }

  private async playFallbackTextToSpeech() {
    this.isSpeaking = true;
    this.cdr.detectChanges();

    const detailedText = [
      this.info,
      this.history,
      this.importance,
      this.recommendations
    ].filter(Boolean).join('. ');

    const textToSpeak = this.isRouteContext
      ? this.route?.description || ''
      : detailedText || this.info || '';

    if (!textToSpeak) {
      this.isSpeaking = false;
      this.cdr.detectChanges();
      return;
    }

    try {
      await TextToSpeech.speak({
        text: textToSpeak,
        lang: 'es-MX',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0
      });
    } catch (error) {
      console.error('Error usando TextToSpeech:', error);
    } finally {
      this.isSpeaking = false;
      this.cdr.detectChanges();
    }
  }

  private async stopNarration() {
    this.stopLocalAudio();
    await TextToSpeech.stop();

    this.isSpeaking = false;
    this.cdr.detectChanges();
  }

  private stopLocalAudio() {
    if (this.audioPlayer) {
      this.audioPlayer.pause();
      this.audioPlayer.currentTime = 0;
      this.audioPlayer.src = '';
      this.audioPlayer.load();
      this.audioPlayer = undefined;
    }
  }

  hasARExperience(): boolean {
    if (this.isRouteContext || !this.title) {
      return false;
    }

    const normalizedTitle = this.normalizeText(this.title);

    return (
      normalizedTitle.includes('iglesia') ||
      normalizedTitle.includes('tila') ||
      normalizedTitle.includes('colores')
    );
  }

  async openARExperience() {
    await this.stopNarration();

    window.open(
      'https://steelfenix09.github.io/Innova/index/index.html',
      '_blank',
      'noopener,noreferrer'
    );
  }

  ngOnDestroy(): void {
    this.stopLocalAudio();
    TextToSpeech.stop();

    if (this.favSubscription) {
      this.favSubscription.unsubscribe();
    }

    if (this.visitedSubscription) {
      this.visitedSubscription.unsubscribe();
    }

    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }

  dismiss(refresh: boolean = false) {
    this.stopLocalAudio();
    TextToSpeech.stop();

    if (this.displayMode === 'modal') {
      this.modalCtrl.dismiss({ refresh });
    } else if (this.displayMode === 'popup' && this.onPopupClose) {
      this.onPopupClose();
    }
  }
}