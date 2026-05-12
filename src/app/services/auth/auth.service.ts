import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap, catchError, throwError } from 'rxjs';
import { ApiService } from '../api/api.service';
import { Router } from '@angular/router';
import { Login } from '../../models/login.model';
import { UserService } from '../user/user.service';
import { FavoritesService } from '../favorites/favorites.service';
import { VisitedService } from '../visited/visited.service';
import { ToastController } from '@ionic/angular/standalone';
import { GamificationService } from '../gamification/gamification.service';

interface UserResponse {
  id: string | number;
  first_name: string;
  last_name: string;
  email: string;
  avatar?: string;
  description?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  private currentUserId = new BehaviorSubject<string | number | null>(null);

  isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  currentUserId$ = this.currentUserId.asObservable();

  constructor(
    private apiService: ApiService,
    private router: Router,
    private userService: UserService,
    private favoritesService: FavoritesService,
    private visitedService: VisitedService,
    private toastController: ToastController,
    private gamificationService: GamificationService,
  ) {
    this.checkAuthStatus();
  }

  private async showToast(message: string, color: string = 'medium') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color,
    });

    await toast.present();
  }

  private checkAuthStatus(): void {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');

    console.log('Token en localStorage:', token ? 'Presente' : 'No encontrado');

    this.isAuthenticatedSubject.next(!!token);
    this.currentUserId.next(userId || null);

    if (token) {
      console.log('Verificando token con el backend...');

      this.apiService.getUserDetail<UserResponse>().subscribe({
        next: (userData) => {
          console.log('Token válido, datos de usuario obtenidos:', userData);
          this.setUserData(userData);
          this.reloadUserData();
          this.gamificationService.loadProfile().subscribe({
            error: (error) =>
              console.error('Error al cargar gamificación:', error),
          });
        },
        error: (error) => {
          console.error('Error al verificar token:', error);
          this.showToast(
            'Error de autenticación: ' + this.getErrorMessage(error),
            'danger',
          );
          this.logout();
        },
      });
    }
  }

  private setUserData(userData: UserResponse): void {
    localStorage.setItem('userId', userData.id.toString());
    this.currentUserId.next(userData.id);

    this.userService.setBackendUser({
      id: userData.id,
      first_name: userData.first_name || '',
      last_name: userData.last_name || '',
      email: userData.email || '',
      avatar: userData.avatar || '',
      description: userData.description || '',
    });

    console.log('Datos de usuario guardados localmente');
  }

  private reloadUserData(): void {
    console.log('Recargando datos de usuario: favoritos y visitados');

    this.favoritesService.refresh();
    this.visitedService.refresh();
  }

  login(credentials: Login): Observable<any> {
    console.log('Intentando iniciar sesión con:', credentials.email);

    return this.apiService
      .login<any>(credentials.email, credentials.password)
      .pipe(
        tap((response) => {
          console.log('Respuesta del login:', response);

          if (response && response.token) {
            localStorage.setItem('token', response.token);
            this.isAuthenticatedSubject.next(true);

            console.log('Obteniendo detalles del usuario...');

            this.apiService.getUserDetail<UserResponse>().subscribe({
              next: (userData) => {
                console.log('Detalles de usuario obtenidos:', userData);
                this.setUserData(userData);
                this.reloadUserData();
              },
              error: (err) => {
                console.error('Error al obtener detalles del usuario:', err);
                this.showToast('Error al obtener datos de usuario', 'warning');
              },
            });
          } else {
            console.error('Respuesta sin token:', response);
            this.showToast(
              'Error: respuesta del servidor incorrecta',
              'danger',
            );
          }
        }),
        catchError((error) => {
          console.error('Error en login:', error);
          this.showToast(
            'Error de inicio de sesión: ' + this.getErrorMessage(error),
            'danger',
          );
          return throwError(() => error);
        }),
      );
  }

  register(userData: any): Observable<any> {
    console.log('Registrando usuario:', userData.email);

    return this.apiService.signup<any>(userData).pipe(
      tap((response) => {
        console.log('Respuesta de registro:', response);
        this.showToast('Registro exitoso', 'success');
      }),
      catchError((error) => {
        console.error('Error en registro:', error);
        this.showToast(
          'Error de registro: ' + this.getErrorMessage(error),
          'danger',
        );
        return throwError(() => error);
      }),
    );
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('backendUser');

    this.isAuthenticatedSubject.next(false);
    this.currentUserId.next(null);

    this.router.navigate(['/login']);
    console.log('Sesión cerrada');
  }

  isLoggedIn(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  getCurrentUserId(): string | number | null {
    return this.currentUserId.value;
  }

  private getErrorMessage(error: any): string {
    if (error.error && error.error.non_field_errors) {
      return error.error.non_field_errors[0];
    }

    if (error.error && error.error.detail) {
      return error.error.detail;
    }

    if (error.error && error.error.message) {
      return error.error.message;
    }

    if (error.message) {
      return error.message;
    }

    return 'Error desconocido';
  }
}
