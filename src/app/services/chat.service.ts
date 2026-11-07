import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';

import { environment } from 'src/environments/environment';

export interface ChatPlace {
  id: string;
  name: string;
  distance_km?: number;
}

export interface ChatAction {
  type:
    | 'map'
    | 'favorites'
    | 'filter'
    | 'places'
    | 'itinerary'
    | 'directions';

  label: string;
  category?: string;
  place_id?: string;
  place_ids?: string[];
}

export interface ChatResponse {
  reply: string;
  places?: ChatPlace[];
  actions?: ChatAction[];
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl =
    `${environment.apiUrl.replace(/\/+$/, '')}/api/chat/`;

  constructor(private http: HttpClient) {}

  ask(data: Record<string, unknown>): Observable<ChatResponse> {
    const token = localStorage.getItem('token');

    let headers = new HttpHeaders();

    if (token) {
      headers = headers.set(
        'Authorization',
        `Token ${token}`
      );
    }

    return this.http
      .post<ChatResponse>(
        this.apiUrl,
        data,
        { headers }
      )
      .pipe(timeout(20000));
  }
}