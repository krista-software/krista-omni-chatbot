import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { StorageService } from '../../services/storage.service';

/**
 * HTTP Interceptor for adding authentication headers to all requests
 *
 * This interceptor centralizes the authentication header logic that was
 * previously in ApiService.getAuthenticatedHeaders().
 *
 * Headers added:
 * - Accept: application/json;charset=UTF-8
 * - Content-Type: application/json;charset=UTF-8 (except for FormData uploads)
 * - Chatbot-Session-Id: Session ID from storage
 * - X-Krista-Context: Auth context from Authenticator (if available)
 *
 * Note: For FormData uploads (file uploads), Content-Type is NOT set to allow
 * the browser to automatically set it to multipart/form-data with the correct boundary.
 */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(private storageService: StorageService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Skip interceptor for non-API requests (e.g., assets, external URLs)
    if (!this.shouldIntercept(request)) {
      return next.handle(request);
    }

    // Clone the request and add headers
    let headers = request.headers
      .set('Accept', 'application/json;charset=UTF-8');

    // IMPORTANT: Don't set Content-Type for FormData uploads
    // The browser will automatically set it with the correct boundary
    // Only set Content-Type for non-FormData requests
    if (!(request.body instanceof FormData)) {
      headers = headers.set('Content-Type', 'application/json;charset=UTF-8');
    }

    // Add Chatbot-Session-Id + X-Krista-Context headers. Both are derived
    // from the same clientSessionId in storage — the X-Krista-Context value
    // is the URI-encoded JSON {clientSessionId: <id>} envelope the server
    // expects. This used to live in assets/authenticator.js; inlined here
    // so we don't depend on a separate vanilla-JS module just to format
    // one header value.
    const sessionId = this.storageService.getClientSessionId();
    if (sessionId) {
      headers = headers.set('Chatbot-Session-Id', sessionId);
      headers = headers.set('X-Krista-Context',
          encodeURIComponent(JSON.stringify({ clientSessionId: sessionId })));
    }

    const authRequest = request.clone({ headers });
    return next.handle(authRequest);
  }

  /**
   * Determine if this request should have auth headers added
   * Skip for external URLs and asset requests
   */
  private shouldIntercept(request: HttpRequest<unknown>): boolean {
    const url = request.url;
    
    // Skip external URLs (those starting with http:// or https:// that aren't our API)
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // Check if it's our API by looking for /extension/ or /chatbot/
      if (!url.includes('/extension/') && !url.includes('/chatbot/')) {
        return false;
      }
    }

    // Skip asset requests
    if (url.includes('/assets/') || url.endsWith('.json') || url.endsWith('.html')) {
      return false;
    }

    return true;
  }
}

