import { Injectable } from '@angular/core';
import { ApiService } from '../api/api.service';
import { Route, PoiResponse } from 'src/app/models/route.model';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface CustomRoutePlace {
  id: string;
  place: string;
  place_name: string;
  place_latitude: string;
  place_longitude: string;
  place_image: string;
  order: number;
}

export interface CustomRoute {
  id: string;
  name: string;
  description: string;
  created_at: string;
  route_places: CustomRoutePlace[];
}

export interface CreateCustomRoutePayload {
  name: string;
  description?: string;
  places: string[];
}

@Injectable({
  providedIn: 'root'
})
export class RouteService {
  constructor(private apiService: ApiService) {}

  getAllRoutes(): Observable<Route[]> {
    return this.apiService.getData<PoiResponse>('/routes/').pipe(
      map(response => response.results)
    );
  }

  getRouteById(id: string): Observable<Route> {
    return this.apiService.getData<Route>(`/routes/${id}/`);
  }

  getCustomRoutes(): Observable<CustomRoute[]> {
    return this.apiService.getData<any>('/custom-routes/').pipe(
      map(response => {
        if (Array.isArray(response)) {
          return response;
        }

        if (response && response.results) {
          return response.results;
        }

        return [];
      })
    );
  }

  createCustomRoute(payload: CreateCustomRoutePayload): Observable<CustomRoute> {
    return this.apiService.postData<CustomRoute>('/custom-routes/', payload);
  }
}