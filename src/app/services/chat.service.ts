import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpHeaders,
  HttpParams
} from '@angular/common/http';
import { Observable, timeout } from 'rxjs';

import { environment } from 'src/environments/environment';

export type ChatActionType =
  | 'map'
  | 'favorites'
  | 'filter'
  | 'places'
  | 'itinerary'
  | 'directions'
  | 'place'
  | 'location';

export interface ChatPlace {
  id: string;
  name: string;
  category?: string;
  municipality?: string;
  description?: string;
  image?: string | null;
  latitude?: number;
  longitude?: number;
  schedule?: string;
  cost?: string;
  route_name?: string;
  route_duration?: string;
  distance_km?: number;
}

export interface ChatAction {
  type: ChatActionType;
  label: string;
  category?: string;
  place_id?: string;
  place_ids?: string[];
}

export interface ChatSuggestion {
  label: string;
  message: string;
}

export interface ChatMeta {
  intent?: string;
  count?: number;
  radius_km?: number;
  requires_location?: boolean;
  requires_place?: boolean;
  estimated_minutes?: number;
  estimated_distance_km?: number;
}

export interface ChatContext {
  place_id?: string | null;
  place_name?: string | null;
  radius_km?: number;
  has_location?: boolean;
}

export interface ChatAgent {
  name: string;
  role: string;
  online: boolean;
}

export interface ChatMenuItem {
  id: string;
  label: string;
  group: string;
}

export interface ChatResponse {
  reply: string;
  kind?: 'text' | 'places' | 'itinerary' | 'filter' | 'location' | 'error';
  places?: ChatPlace[];
  actions?: ChatAction[];
  suggestions?: ChatSuggestion[];
  meta?: ChatMeta;
  session_id?: string;
  context?: ChatContext;
  agent?: ChatAgent;
  menu?: ChatMenuItem[];
  history?: Array<{
    role: string;
    content: string;
    intent?: string;
    created_at?: string;
  }>;
}

export interface ChatRequest {
  message?: string;
  intent?: string;
  place_id?: string;
  latitude?: number;
  longitude?: number;
  radius_km?: number;
  minutes?: number;
  session_id?: string;
  context?: Record<string, unknown>;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl =
    `${environment.apiUrl.replace(/\/+$/, '')}/api/chat/`;

  constructor(private http: HttpClient) {}

  ask(data: ChatRequest): Observable<ChatResponse> {
    return this.http
      .post<ChatResponse>(this.apiUrl, data, {
        headers: this.getHeaders()
      })
      .pipe(timeout(25000));
  }

  greet(sessionId?: string): Observable<ChatResponse> {
    let params = new HttpParams();

    if (sessionId) {
      params = params.set('session_id', sessionId);
    }

    return this.http
      .get<ChatResponse>(this.apiUrl, {
        headers: this.getHeaders(),
        params
      })
      .pipe(timeout(25000));
  }

  clearSession(sessionId?: string): Observable<void> {
    let params = new HttpParams();

    if (sessionId) {
      params = params.set('session_id', sessionId);
    }

    return this.http
      .delete<void>(this.apiUrl, {
        headers: this.getHeaders(),
        params
      })
      .pipe(timeout(15000));
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');

    let headers = new HttpHeaders();

    if (token) {
      headers = headers.set(
        'Authorization',
        `Token ${token}`
      );
    }

    return headers;
  }
}
