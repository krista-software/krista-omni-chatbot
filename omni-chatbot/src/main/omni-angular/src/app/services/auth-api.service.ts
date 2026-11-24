import { HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';
import { environment } from '../../environments/environment';
import { AuthData } from '../models/api.model';

/** Queue error response from login (HTTP 429) */
export interface QueuedLoginResponse {
  code: number;
  message: string;
  queueToken: number;
  queuePosition: number;
  estimatedWaitMs: number;
  pollIntervalMs: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuthApiService {

  constructor(
    private apiService: ApiService,
    private storageService: StorageService
  ) {}

  /**
   * Login API call — POST /chatbot/authn/login.
   *
   * Returns auth data on success (200), or throws on error.
   * When the concurrent-user limit is reached the server returns 429 with a
   * QueuedLoginResponse body — the caller (AppFacade) handles this case.
   */
  login(payload: Record<string, unknown> = {}): Observable<AuthData> {
    const url = this.apiService.generateApiUrl(environment.apiEndpoints.login);
    const headers = new HttpHeaders({
      'Content-Type': 'application/json;charset=UTF-8',
      'source': 'chatbot',
    });
    return this.apiService.http.post<AuthData>(url, payload, { headers }).pipe(
      map(data => {
        if (!data?.accountId) {
          throw new Error('Login failed: no accountId in response');
        }
        return data;
      })
    );
  }

  /**
   * Logout API call - POST /authn/v1/logout
   */
  logout(): Observable<void> {
    const url = this.apiService.generateApiUrl(environment.apiEndpoints.logout);
    const headers = this.apiService.getAuthenticatedHeaders();

    return this.apiService.http.post(url, {}, {
      headers,
      responseType: 'text'
    }).pipe(
      map(() => {
        this.storageService.logOut();
        this.deleteCookie('chatbotSessionId');
        return;
      }),
      catchError(error => {
        this.storageService.logOut();
        this.deleteCookie('chatbotSessionId');
        return throwError(() => error);
      })
    );
  }

  private deleteCookie(name: string): void {
    if (typeof document === 'undefined') return;
    const expired = 'expires=Thu, 01 Jan 1970 00:00:00 UTC';
    // Clear with root path
    document.cookie = `${name}=;${expired};path=/;`;
    // Clear with current pathname-derived path (matches server-set cookie path)
    const segments = window.location.pathname.split('/').filter(Boolean);
    if (segments.length >= 3) {
      const cookiePath = '/' + segments.slice(0, 3).join('/') + '/';
      document.cookie = `${name}=;${expired};path=${cookiePath};`;
    }
  }
}
