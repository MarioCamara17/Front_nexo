import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api/api.service';
import { Poi } from '../models/poi.model';
import { TrainStation, StationCheckin } from '../models/train-station.model';
@Injectable({providedIn: 'root'})
export class TrainStationService {
  constructor(private api: ApiService) {}
  list(): Observable<{stations: TrainStation[]}> {
    return this.api.getData<{stations: TrainStation[]}>('/gamification/stations/');
  }
  nearby(slug: string, radius: number): Observable<{results: Poi[]; count: number}> {
    return this.api.getData<{results: Poi[]; count: number}>(`/gamification/stations/${encodeURIComponent(slug)}/nearby/`, {radius_km: radius});
  }
  visit(slug: string, position: GeolocationPosition): Observable<StationCheckin> {
    return this.api.postData<StationCheckin>(`/gamification/stations/${encodeURIComponent(slug)}/visit/`, {
      latitude: position.coords.latitude, longitude: position.coords.longitude,
      accuracy_m: position.coords.accuracy, timestamp_ms: position.timestamp
    });
  }
}
