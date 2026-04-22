import { Injectable } from '@angular/core';
import { Poi } from 'src/app/models/poi.model';
import { ApiService } from '../api/api.service';
import { Observable } from 'rxjs';

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
}