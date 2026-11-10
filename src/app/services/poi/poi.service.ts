import { Injectable } from '@angular/core';
import { Poi } from 'src/app/models/poi.model';
import { ApiService } from '../api/api.service';
import { Observable } from 'rxjs';

export interface NearbyParams {
  latitude: number;
  longitude: number;
  radius_km?: number;
  category?: string;
  municipality?: string;
  search?: string;
  limit?: number;
}

export interface NearbyResponse {
  center: { latitude: number; longitude: number };
  radius_km: number;
  count: number;
  results: Poi[];
}

@Injectable({
  providedIn: 'root'
})
export class PoiService {
  constructor(private apiService: ApiService) {}

  getAll(): Observable<Poi[]> {
    return this.apiService.getData<Poi[]>('/places/');
  }

  getById(id: string): Observable<Poi> {
    return this.apiService.getData<Poi>(`/places/${id}/`);
  }

  /**
   * Lugares dentro de un radio en kilómetros.
   *
   * La distancia que devuelve el backend es geodésica (línea recta),
   * no un recorrido por carretera.
   */
  getNearby(params: NearbyParams): Observable<NearbyResponse> {
    return this.apiService.getData<NearbyResponse>('/places/nearby/', params);
  }
}
