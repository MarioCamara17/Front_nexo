import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpHeaders,
  HttpParams,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import { catchError, map, switchMap, tap, timeout } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = environment.apiUrl;
  private apiVersion = environment.apiVersion;
  private baseApiPath = `${this.apiUrl}/api/${this.apiVersion}`;
  private timeoutMs = 30000;

  constructor(private http: HttpClient) {
    console.log('ApiService inicializado con URL base:', this.baseApiPath);
  }

  private handleError(error: HttpErrorResponse) {
    console.error('Error en petición HTTP:', error);

    if (error.error instanceof ErrorEvent) {
      return throwError(() => new Error('Error de conexión. Verifica tu conexión a internet.'));
    }

    if (error.status === 0) {
      return throwError(() => new Error('No se pudo conectar al servidor. Revisa CORS o que el backend esté activo.'));
    }

    return throwError(() => error);
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    let headers = new HttpHeaders();

    if (token) {
      headers = headers.set('Authorization', `Token ${token}`);
    }

    return headers;
  }

  getData<T>(endpoint: string, params?: any, headers?: HttpHeaders): Observable<T> {
    let httpParams = new HttpParams();

    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key].toString());
        }
      });
    }

    return this.http.get<T>(`${this.baseApiPath}${endpoint}`, {
      params: httpParams,
      headers: headers || this.getAuthHeaders()
    }).pipe(
      timeout(this.timeoutMs),
      tap(response => console.log(`Respuesta GET ${endpoint}:`, response)),
      catchError(this.handleError)
    );
  }

  postData<T>(endpoint: string, data: any, headers?: HttpHeaders): Observable<T> {
    return this.http.post<T>(`${this.baseApiPath}${endpoint}`, data, {
      headers: headers || this.getAuthHeaders()
    }).pipe(
      timeout(this.timeoutMs),
      tap(response => console.log(`Respuesta POST ${endpoint}:`, response)),
      catchError(this.handleError)
    );
  }

  putData<T>(endpoint: string, data: any, headers?: HttpHeaders): Observable<T> {
    return this.http.put<T>(`${this.baseApiPath}${endpoint}`, data, {
      headers: headers || this.getAuthHeaders()
    }).pipe(
      timeout(this.timeoutMs),
      tap(response => console.log(`Respuesta PUT ${endpoint}:`, response)),
      catchError(this.handleError)
    );
  }

  patchData<T>(endpoint: string, data: any, headers?: HttpHeaders): Observable<T> {
    return this.http.patch<T>(`${this.baseApiPath}${endpoint}`, data, {
      headers: headers || this.getAuthHeaders()
    }).pipe(
      timeout(this.timeoutMs),
      tap(response => console.log(`Respuesta PATCH ${endpoint}:`, response)),
      catchError(this.handleError)
    );
  }

  patchFormData<T>(endpoint: string, formData: FormData): Observable<T> {
    return this.http.patch<T>(`${this.baseApiPath}${endpoint}`, formData, {
      headers: this.getAuthHeaders()
    }).pipe(
      timeout(this.timeoutMs),
      tap(response => console.log(`Respuesta PATCH FormData ${endpoint}:`, response)),
      catchError(this.handleError)
    );
  }

  deleteData<T>(endpoint: string, headers?: HttpHeaders): Observable<T> {
    return this.http.delete<T>(`${this.baseApiPath}${endpoint}`, {
      headers: headers || this.getAuthHeaders()
    }).pipe(
      timeout(this.timeoutMs),
      tap(response => console.log(`Respuesta DELETE ${endpoint}:`, response)),
      catchError(this.handleError)
    );
  }

  uploadFile<T>(endpoint: string, file: File, formData?: FormData, headers?: HttpHeaders): Observable<T> {
    const fileFormData = formData || new FormData();

    if (!formData) {
      fileFormData.append('file', file, file.name);
    }

    return this.http.post<T>(`${this.baseApiPath}${endpoint}`, fileFormData, {
      headers: headers || this.getAuthHeaders()
    }).pipe(
      timeout(this.timeoutMs),
      catchError(this.handleError)
    );
  }

  downloadFile(endpoint: string, headers?: HttpHeaders): Observable<Blob> {
    return this.http.get(`${this.baseApiPath}${endpoint}`, {
      responseType: 'blob',
      headers: headers || this.getAuthHeaders()
    }).pipe(
      timeout(this.timeoutMs),
      catchError(this.handleError)
    );
  }

  login<T>(email: string, password: string): Observable<T> {
    return this.postData<T>('/auth/token/', { email, password }, new HttpHeaders());
  }

  logout<T>(): Observable<T> {
    return this.postData<T>('/auth/logout/', {});
  }

  signup<T>(userData: any): Observable<T> {
    return this.postData<T>('/auth/signup/', userData, new HttpHeaders());
  }

  getUserDetail<T>(): Observable<T> {
    return this.getData<T>('/auth/user-detail/');
  }

  resetPassword<T>(email: string): Observable<T> {
    return this.postData<T>('/auth/reset/', { email });
  }

  getStates<T>(params?: any): Observable<T> {
    return this.getData<T>('/states/', params);
  }

  getStateById<T>(id: number): Observable<T> {
    return this.getData<T>(`/states/${id}/`);
  }

  getMunicipalities<T>(params?: any): Observable<T> {
    return this.getData<T>('/municipalities/', params);
  }

  getMunicipalityById<T>(id: number): Observable<T> {
    return this.getData<T>(`/municipalities/${id}/`);
  }

  getCategories<T>(params?: any): Observable<T> {
    return this.getData<T>('/categories/', params);
  }

  getCategoryById<T>(id: number): Observable<T> {
    return this.getData<T>(`/categories/${id}/`);
  }

  getPlaces<T>(params?: any): Observable<T> {
    return this.getData<T>('/places/', params);
  }

  getPlaceById<T>(id: string): Observable<T> {
    return this.getData<T>(`/places/${id}/`);
  }

  updatePlace<T>(id: string, data: any): Observable<T> {
    return this.patchData<T>(`/places/${id}/`, data);
  }

  getFavorites<T>(headers?: HttpHeaders): Observable<T> {
    return this.getData<T>('/favorites/', undefined, headers || this.getAuthHeaders());
  }

  addFavorite<T>(
    data: { place: string; user: string | number },
    headers?: HttpHeaders
  ): Observable<T> {
    const actualHeaders = headers || this.getAuthHeaders();

    return this.http.get<any>(`${this.baseApiPath}/favorites/?place=${data.place}`, {
      headers: actualHeaders
    }).pipe(
      map(response => {
        if (response && response.results && response.results.length > 0) {
          return response.results[0];
        }

        return null;
      }),
      catchError(() => of(null)),
      switchMap(existingFavorite => {
        if (existingFavorite) {
          return of(existingFavorite as T);
        }

        return this.http.post<T>(`${this.baseApiPath}/favorites/`, data, {
          headers: actualHeaders
        });
      }),
      catchError(this.handleError)
    );
  }

  removeFavorite<T>(favoriteId: string, headers?: HttpHeaders): Observable<T> {
    return this.deleteData<T>(`/favorites/${favoriteId}/`, headers || this.getAuthHeaders());
  }

  getVisitedPlaces<T>(headers?: HttpHeaders): Observable<T> {
    return this.getData<T>('/visited-places/', undefined, headers || this.getAuthHeaders());
  }

  addVisitedPlace<T>(
    placeId: string,
    visitedDate: string,
    additionalData?: any,
    headers?: HttpHeaders
  ): Observable<T> {
    const data = {
      place: placeId,
      visited_date: visitedDate,
      ...additionalData
    };

    return this.postData<T>('/visited-places/', data, headers || this.getAuthHeaders());
  }

  removeVisitedPlace<T>(visitId: string, headers?: HttpHeaders): Observable<T> {
    return this.deleteData<T>(`/visited-places/${visitId}/`, headers || this.getAuthHeaders());
  }

  getRoutes<T>(params?: any): Observable<T> {
    return this.getData<T>('/routes/', params);
  }

  getRouteById<T>(id: string): Observable<T> {
    return this.getData<T>(`/routes/${id}/`);
  }

  getMunicipalityRoutes<T>(municipalityId?: number): Observable<T> {
    const params = municipalityId ? { municipality: municipalityId } : undefined;
    return this.getData<T>('/municipality-routes/', params);
  }

  getCsrfToken<T>(): Observable<T> {
    return this.getData<T>('/auth/csrf/');
  }
}