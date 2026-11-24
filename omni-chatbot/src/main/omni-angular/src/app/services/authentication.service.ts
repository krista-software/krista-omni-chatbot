import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { AuthApiService } from './auth-api.service';

interface AuthenticationExtras {
  newSession?: boolean;
  [key: string]: unknown;
}

export interface AuthenticationData {
  accountId: string;
  clientSessionId: string;
  kristaAccountId: string;
  personId: string;
  name: string;
  extras?: AuthenticationExtras;
}

@Injectable({
  providedIn: 'root'
})
export class AuthenticationService {
  private isLoggedInSubject = new BehaviorSubject<boolean>(false);
  private userDataSubject = new BehaviorSubject<AuthenticationData | null>(null);
  private authenticationData: AuthenticationData | null = null;

  constructor(private authApiService: AuthApiService) {}


  /**
   * Get current user data
   */
  getUserData(): AuthenticationData | null {
    return this.authenticationData;
  }

  /**
   * Logout user. Routes through AuthApiService (Angular HttpClient) instead
   * of the legacy window.Authenticator.logout() — server-side endpoint is
   * the same {@code /chatbot/authn/v1/logout} path AuthApiService already
   * uses for the explicit logout button.
   */
  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.authApiService.logout());
    } catch (error) {
      // Network/server errors are swallowed here; storage is still cleared
      // in the finally block so the client returns to an unauthenticated
      // state even when the server-side logout fails.
    } finally {
      this.authenticationData = null;
      this.isLoggedInSubject.next(false);
      this.userDataSubject.next(null);
    }
  }

  /**
   * Get client session ID for WebSocket connection
   */
  getClientSessionId(): string | null {
    return this.authenticationData?.clientSessionId || null;
  }
}
