import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, tap, catchError, finalize } from 'rxjs/operators';
import { ApiService } from '../api/api.service';
import { HttpHeaders } from '@angular/common/http';
import { UserService } from '../user/user.service';
import { ToastController } from '@ionic/angular/standalone';
import { GamificationService } from '../gamification/gamification.service';

interface VisitedPlaceResponse {
  id: string;
  place: any;
  user: number | string;
  visited_date: string;
  notes?: string;
}

@Injectable({
  providedIn: 'root'
})
export class VisitedService {
  private visitedList = new BehaviorSubject<string[]>([]);
  private visitDates = new BehaviorSubject<Record<string, string>>({});
  private visitMap = new Map<string, { visitId: string; date: string | null; notes?: string }>();

  private isLoading = false;
  private pendingOperations = new Map<string, boolean>();

  constructor(
    private apiService: ApiService,
    private userService: UserService,
    private toastController: ToastController,
    private gamificationService: GamificationService
  ) {
    this.loadVisited();
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders().set('Authorization', `Token ${token}`);
  }

  private loadVisited() {
    if (this.isLoading) {
      return;
    }

    this.isLoading = true;
    const headers = this.getAuthHeaders();

    this.apiService.getVisitedPlaces<any>(headers).pipe(
      map(response => {
        if (Array.isArray(response)) {
          return response;
        }

        if (response && response.results) {
          return response.results;
        }

        console.error('Formato de respuesta desconocido:', response);
        return [];
      }),
      finalize(() => {
        this.isLoading = false;
      })
    ).subscribe({
      next: (visitedPlaces) => {
        if (!Array.isArray(visitedPlaces)) {
          console.error('La respuesta no es un array:', visitedPlaces);
          this.visitedList.next([]);
          this.visitDates.next({});
          return;
        }

        const visitedPlaceIds = visitedPlaces
          .map(vp => {
            if (typeof vp.place === 'string') {
              return vp.place;
            }

            if (vp.place && vp.place.id) {
              return vp.place.id;
            }

            return null;
          })
          .filter(id => id !== null) as string[];

        const dates: Record<string, string> = {};
        this.visitMap.clear();

        visitedPlaces.forEach(vp => {
          const placeId =
            typeof vp.place === 'string'
              ? vp.place
              : vp.place && vp.place.id
                ? vp.place.id
                : null;

          if (placeId) {
            this.visitMap.set(placeId, {
              visitId: vp.id,
              date: vp.visited_date,
              notes: vp.notes
            });

            if (vp.visited_date) {
              dates[placeId] = vp.visited_date;
            }
          }
        });

        this.visitedList.next(visitedPlaceIds);
        this.visitDates.next(dates);
        this.pendingOperations.clear();
      },
      error: (error) => {
        console.error('Error loading visited places:', error);
        this.visitedList.next([]);
        this.visitDates.next({});
        this.isLoading = false;
      }
    });
  }

  getVisited(): Observable<string[]> {
    return this.visitedList.asObservable();
  }

  getVisitDates(): Observable<Record<string, string>> {
    return this.visitDates.asObservable();
  }

  getVisitDateById(placeId: string): Date | null {
    const visitInfo = this.visitMap.get(placeId);
    return visitInfo?.date ? new Date(visitInfo.date) : null;
  }

  isVisited(placeId: string): boolean {
    return this.visitMap.has(placeId);
  }

  addVisited(placeId: string, date = new Date(), notes?: string): Observable<boolean> {
    if (this.pendingOperations.get(placeId)) {
      console.log('Operación pendiente para este lugar, esperando...');
      return of(true);
    }

    if (this.isVisited(placeId)) {
      return of(true);
    }

    this.pendingOperations.set(placeId, true);

    const userId = this.userService.getCurrentUserId();

    if (!userId) {
      console.error('No se pudo obtener el ID del usuario');
      this.pendingOperations.delete(placeId);
      return of(false);
    }

    const headers = this.getAuthHeaders();
    const dateStr = date.toISOString().split('T')[0];

    return this.apiService.addVisitedPlace<VisitedPlaceResponse>(
      placeId,
      dateStr,
      notes ? { notes } : undefined,
      headers
    ).pipe(
      tap(response => {
        if (response && response.id) {
          const currentVisited = this.visitedList.value;
          const currentDates = { ...this.visitDates.value };

          let responseId: string;

          if (typeof response.place === 'string') {
            responseId = response.place;
          } else if (response.place && response.place.id) {
            responseId = response.place.id;
          } else {
            responseId = placeId;
          }

          this.visitMap.set(responseId, {
            visitId: response.id,
            date: response.visited_date,
            notes: response.notes
          });

          if (response.visited_date) {
            currentDates[responseId] = response.visited_date;
          }

          if (!currentVisited.includes(responseId)) {
            this.visitedList.next([...currentVisited, responseId]);
          }

          this.visitDates.next(currentDates);

          this.showToast('Lugar marcado como visitado');

          this.gamificationService.awardPoints('visited_place', responseId).subscribe({
            next: () => {
              console.log('Puntos otorgados por lugar visitado:', responseId);
            },
            error: (error: unknown) => {
              console.error('Error al otorgar puntos por visita:', error);
            }
          });
        }
      }),
      map(() => true),
      catchError(error => {
        console.error('Error adding visit:', error);
        this.showToast('Error al marcar como visitado. Reintentando...');
        return of(false);
      }),
      finalize(() => {
        setTimeout(() => {
          this.pendingOperations.delete(placeId);
        }, 500);
      })
    );
  }

  removeVisited(placeId: string): Observable<boolean> {
    if (this.pendingOperations.get(placeId)) {
      console.log('Operación pendiente para este lugar, esperando...');
      return of(true);
    }

    if (!this.isVisited(placeId)) {
      return of(false);
    }

    this.pendingOperations.set(placeId, true);

    const visitInfo = this.visitMap.get(placeId);

    if (!visitInfo || !visitInfo.visitId) {
      this.pendingOperations.delete(placeId);
      return of(false);
    }

    const headers = this.getAuthHeaders();

    return this.apiService.removeVisitedPlace<any>(visitInfo.visitId, headers).pipe(
      tap(() => {
        const currentVisited = this.visitedList.value;
        const currentDates = { ...this.visitDates.value };

        this.visitMap.delete(placeId);
        delete currentDates[placeId];

        this.visitedList.next(currentVisited.filter(id => id !== placeId));
        this.visitDates.next(currentDates);

        this.showToast('Lugar eliminado de visitados');
      }),
      map(() => true),
      catchError(error => {
        console.error('Error removing visit:', error);
        this.showToast('Error al eliminar de visitados. Reintentando...');
        return of(false);
      }),
      finalize(() => {
        setTimeout(() => {
          this.pendingOperations.delete(placeId);
        }, 500);
      })
    );
  }

  toggleVisited(placeId: string): Observable<boolean> {
    return this.isVisited(placeId)
      ? this.removeVisited(placeId)
      : this.addVisited(placeId);
  }

  refresh() {
    this.loadVisited();
  }

  private async showToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom',
      color: 'medium'
    });

    await toast.present();
  }
}