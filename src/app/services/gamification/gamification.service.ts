import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { ApiService } from '../api/api.service';

export interface Badge {
  icon: string;
  name: string;
  description: string;
  unlocked: boolean;
}

export interface Activity {
  id: string;
  action: string;
  points: number;
  description: string;
  object_id?: string;
  created_at: string;
}

export interface GamificationProfile {
  points: number;
  level: string;
  next_level_points: number | null;
  points_to_next_level: number;
  progress_percent: number;
  visited_places: number;
  favorite_places: number;
  completed_routes: number;
  badges: Badge[];
  unlocked_badges_count: number;
  recent_activities: Activity[];
}

@Injectable({
  providedIn: 'root'
})
export class GamificationService {
  private profileSubject = new BehaviorSubject<GamificationProfile>({
    points: 0,
    level: 'Visitante inicial',
    next_level_points: 100,
    points_to_next_level: 100,
    progress_percent: 0,
    visited_places: 0,
    favorite_places: 0,
    completed_routes: 0,
    badges: [],
    unlocked_badges_count: 0,
    recent_activities: []
  });

  profile$ = this.profileSubject.asObservable();

  constructor(private apiService: ApiService) {}

  loadProfile(): Observable<GamificationProfile> {
    return this.apiService.getData<GamificationProfile>('/gamification/profile/').pipe(
      tap((profile) => {
        this.profileSubject.next(profile);
      })
    );
  }

  getSnapshot(): GamificationProfile {
    return this.profileSubject.value;
  }

  awardPoints(action: string, objectId?: string): Observable<any> {
    return this.apiService.postData<any>('/gamification/award/', {
      action,
      object_id: objectId || null
    }).pipe(
      tap(() => {
        this.loadProfile().subscribe();
      })
    );
  }
}