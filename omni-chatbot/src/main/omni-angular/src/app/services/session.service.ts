import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { catchError, map, finalize } from 'rxjs/operators';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';
import { LoadingService } from './loading.service';
import { TranslationService } from './translation.service';
import { environment } from '../../environments/environment';

export interface SessionResponse {
  sessionId: string;
  inboxId: string;
  workspaceId?: string;
  contactId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private sessionSubject = new BehaviorSubject<SessionResponse | null>(null);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);

  constructor(
    private apiService: ApiService,
    private storageService: StorageService,
    private loadingService: LoadingService,
    private translationService: TranslationService
  ) {}

  /**
   * Create or get existing session
   */
  createSession(languageCode?: string): Observable<SessionResponse> {
    this.loadingSubject.next(true);
    // Use translated message for session creation
    const creatingSessionMessage = this.translationService.instant('initializerProvider.creatingSession');
    this.loadingService.setSessionLoading(true, creatingSessionMessage);
    this.errorSubject.next(null);

    const requestData = {
      languageCode: languageCode || this.storageService.getSelectedLanguage() || 'en'
    };


    // Make direct HTTP call with text response type since the API returns a plain string (inbox ID)
    const url = this.apiService.generateApiUrl(environment.apiEndpoints.getSession);
    const headers = this.apiService.getAuthenticatedHeaders();

    return this.apiService.http.post(url, requestData, {
      headers: headers,
      responseType: 'text'
    }).pipe(
      map(response => {

        // The API returns a plain text string containing the inbox ID
        const inboxId = typeof response === 'string' ? response.trim() : String(response).trim();

        const sessionData: SessionResponse = {
          sessionId: inboxId, // Use inbox ID as session ID for compatibility
          inboxId: inboxId, // The response is actually the inbox ID
          workspaceId: undefined,
          contactId: undefined
        };

        this.sessionSubject.next(sessionData);

        // IMPORTANT: Do NOT overwrite clientSessionId here!
        // The clientSessionId should remain the auth session ID (device_xxx) from authentication,
        // NOT the inbox ID (inbox_S_xxx). The inbox ID is stored separately in sessionData.
        // this.storageService.setClientSessionId(sessionData.sessionId); // REMOVED

        // Note: chatbotSessionId cookie is already set during authentication
        // Don't override it here as it contains the auth session ID needed for WebSocket

        this.loadingSubject.next(false);

        return sessionData;
      }),
      catchError(error => {
        this.errorSubject.next('Failed to create session');
        this.loadingSubject.next(false);

        // Don't create mock data - let the error propagate to the component
        throw error;
      }),
      finalize(() => {
        // Stop centralized loading
        this.loadingService.setSessionLoading(false);
      })
    );
  }

  /**
   * Get current session
   */
  getCurrentSession(): SessionResponse | null {
    return this.sessionSubject.value;
  }

  /**
   * Get current session ID
   */
  getCurrentSessionId(): string | null {
    const session = this.getCurrentSession();
    return session ? session.sessionId : null;
  }
}
