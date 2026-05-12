import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { User } from 'src/app/models/user.model';
import { ApiService } from '../api/api.service';
import { switchMap, distinctUntilChanged, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

interface BackendUser {
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
export class UserService {
  private backendKey = 'backendUser';
  private userSubject: BehaviorSubject<User>;
  private currentUser: User;

  constructor(private apiService: ApiService) {
    this.currentUser = this.loadUser();
    this.userSubject = new BehaviorSubject<User>(this.currentUser);
  }

  private normalizeAvatarUrl(avatar?: string): string {
    if (!avatar) {
      return '';
    }

    if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
      return avatar;
    }

    if (avatar.startsWith('/media/')) {
      return `${environment.apiUrl}${avatar}`;
    }

    if (avatar.startsWith('media/')) {
      return `${environment.apiUrl}/${avatar}`;
    }

    return avatar;
  }

  private getBackendUser(): BackendUser | null {
    const backendUser = localStorage.getItem(this.backendKey);
    return backendUser ? JSON.parse(backendUser) : null;
  }

  private loadUser(): User {
    const backendUser = this.getBackendUser();

    return {
      id: backendUser?.id,
      first_name: backendUser?.first_name || '',
      last_name: backendUser?.last_name || '',
      email: backendUser?.email || '',
      avatar: this.normalizeAvatarUrl(backendUser?.avatar),
      description: backendUser?.description || ''
    };
  }

  private updateCurrentUser(user: User) {
    this.currentUser = { ...user };
    this.userSubject.next(this.currentUser);
  }

  setBackendUser(user: BackendUser) {
    localStorage.setItem(this.backendKey, JSON.stringify(user));
    const updatedUser = this.loadUser();
    this.updateCurrentUser(updatedUser);
  }

  getUser(): Observable<User> {
    return this.userSubject.asObservable().pipe(
      distinctUntilChanged((prev, curr) =>
        prev.id === curr.id &&
        prev.first_name === curr.first_name &&
        prev.last_name === curr.last_name &&
        prev.email === curr.email &&
        prev.avatar === curr.avatar &&
        prev.description === curr.description
      )
    );
  }

  getCurrentUserId(): string | number | null {
    return this.currentUser?.id || null;
  }

  refreshUserFromBackend(): Observable<User> {
    return this.apiService.getUserDetail<BackendUser>().pipe(
      tap((backendUser) => {
        this.setBackendUser(backendUser);
      }),
      switchMap(() => this.getUser())
    );
  }

  setUser(user: User): Observable<User> {
    return this.updateUserProfile({
      first_name: user.first_name,
      last_name: user.last_name,
      description: user.description || ''
    });
  }

  updateUserName(first_name: string, last_name: string): Observable<User> {
    return this.updateUserProfile({ first_name, last_name });
  }

  updateUserProfile(data: Partial<User>): Observable<User> {
    return this.apiService.patchData<BackendUser>('/auth/user-detail/', data).pipe(
      tap((backendUser) => {
        this.setBackendUser(backendUser);
      }),
      switchMap(() => this.getUser())
    );
  }

  updateAvatar(file: File): Observable<User> {
    const formData = new FormData();
    formData.append('avatar', file);

    return this.apiService.patchFormData<BackendUser>('/auth/user-detail/', formData).pipe(
      tap((backendUser) => {
        this.setBackendUser(backendUser);
      }),
      switchMap(() => this.getUser())
    );
  }
}