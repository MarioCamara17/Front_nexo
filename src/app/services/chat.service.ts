import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';

export interface ChatResponse {
  reply: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = `http://${window.location.hostname}:8000/api/chat/`;

  constructor(private http: HttpClient) {}

  sendMessage(message: string): Observable<ChatResponse> {
    return this.http
      .post<ChatResponse>(this.apiUrl, { message })
      .pipe(timeout(190000));
  }
}