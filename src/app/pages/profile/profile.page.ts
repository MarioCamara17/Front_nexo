import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonAvatar,
  IonButton,
  AlertController,
  IonContent
} from '@ionic/angular/standalone';
import { RouterModule } from '@angular/router';
import { Observable, Subscription } from 'rxjs';

import { User } from 'src/app/models/user.model';
import { UserService } from 'src/app/services/user/user.service';
import { AuthService } from '../../services/auth/auth.service';
import {
  GamificationService,
  GamificationProfile,
  Activity
} from 'src/app/services/gamification/gamification.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonAvatar,
    IonButton,
    RouterModule
  ],
})
export class ProfilePage implements OnInit, OnDestroy {
  user: User = {
    first_name: '',
    last_name: '',
    email: '',
    avatar: '',
    description: ''
  };

  gamificationProfile$: Observable<GamificationProfile>;

  private userSubscription?: Subscription;

  constructor(
    private userService: UserService,
    private authService: AuthService,
    private alertController: AlertController,
    private gamificationService: GamificationService
  ) {
    this.gamificationProfile$ = this.gamificationService.profile$;
  }

  ngOnInit() {
    this.loadUserData();
    this.loadGamification();
  }

  ionViewWillEnter() {
    this.loadUserData();
    this.loadGamification();
  }

  ngOnDestroy() {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  private loadUserData() {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }

    this.userSubscription = this.userService.getUser().subscribe({
      next: (user) => {
        this.user = user;
      },
      error: (error) => {
        console.error('Error al cargar datos del usuario:', error);
      }
    });
  }

  private loadGamification() {
    if (!this.authService.isLoggedIn()) {
      return;
    }

    this.gamificationService.loadProfile().subscribe({
      error: (error: unknown) => {
        console.error('Error al cargar gamificación en Perfil:', error);
      }
    });
  }

  getActivityIcon(activity: Activity): string {
    switch (activity.action) {
      case 'visited_place':
        return '📍';
      case 'favorite_place':
        return '❤️';
      case 'custom_route':
        return '🧭';
      case 'completed_route':
        return '🗺️';
      case 'chatbot_use':
        return '💬';
      case 'ar_experience':
        return '👓';
      default:
        return '⭐';
    }
  }

  async logout() {
    const alert = await this.alertController.create({
      header: 'Cerrar sesión',
      message: '¿Estás seguro de que deseas cerrar sesión?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Cerrar sesión',
          handler: () => {
            this.authService.logout();
          }
        }
      ]
    });

    await alert.present();
  }
}