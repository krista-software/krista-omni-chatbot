import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { StorageService } from './storage.service';

export interface ApiRequestOptions {
  headers?: HttpHeaders | { [header: string]: string | string[] };
  params?: HttpParams | { [param: string]: string | number | boolean | ReadonlyArray<string | number | boolean> };
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly baseUrl: string;

  constructor(
    public http: HttpClient,
    private storageService: StorageService
  ) {
    this.baseUrl = environment.apiHost;
  }

  /**
   * Generate API URL with routing ID and endpoint
   * Matches original app's URL construction pattern
   *
   * In development:
   * - Returns: /extension/api/{routingId}/chatbot/config
   * - Proxy intercepts /extension/** and forwards to backend
   *
   * In production:
   * - Returns: https://qa-in.eng.krista.app/extension/api/{routingId}/chatbot/config
   * - Direct call to backend server
   */
  generateApiUrl(endpoint: string, pathParams: { [key: string]: string } = {}): string {
    let url = endpoint;

    // Replace path parameters (e.g., <accountId> -> actual ID)
    // This matches the original app's generateApiUrl function
    Object.keys(pathParams).forEach(key => {
      url = url.replace(`<${key}>`, pathParams[key]);
    });

    // Construct the full URL
    const routingId = environment.chatbotRoutingId; // e.g., /extension/api/A_pR4e9i1qxSCWDPK5rDuig_e_e/

    // Handle slash joining
    let finalUrl = url;
    if (routingId.endsWith('/') && url.startsWith('/')) {
      finalUrl = url.substring(1);
    } else if (!routingId.endsWith('/') && !url.startsWith('/')) {
      finalUrl = `/${url}`;
    }

    // In development, apiHost is empty, so we get: /extension/api/{id}/chatbot/config
    // In production, apiHost is set, so we get: https://host/extension/api/{id}/chatbot/config
    const baseUrl = this.baseUrl; // Empty in dev, full URL in prod

    if (baseUrl) {
      const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      return `${cleanBaseUrl}${routingId}${finalUrl}`;
    } else {
      return `${routingId}${finalUrl}`;
    }
  }

  /**
   * Generate final API URL with hostname transformation
   *
   * DISABLED: The hostname transformation is not needed for this deployment.
   * The backend is hosted at extension.qa-in.eng.krista.app, so we should keep
   * the hostname as-is and use relative URLs.
   */
  private generateFinalAPIUrl(url: string): string {
    // Simply return the URL as-is
    // Relative URLs will be resolved by the browser relative to the current origin
    return url;
  }

  /**
   * Generic GET request with authentication headers
   */
  get<T>(endpoint: string, pathParams: { [key: string]: string } = {}, options: ApiRequestOptions = {}): Observable<T> {
    const url = this.generateApiUrl(endpoint, pathParams);
    const finalUrl = this.generateFinalAPIUrl(url);
    // GET requests carry no body, so Content-Type is meaningless here. It is also a
    // non-CORS-safelisted header, so sending it forces a cross-origin OPTIONS preflight
    // for every GET (e.g. /config, /supportedLanguages). Omitting it keeps those GETs
    // "simple" (no preflight). CORS stays safe: the server adds Access-Control-Allow-Origin
    // to every response, including simple GETs.
    const headers = this.getAuthenticatedHeaders(options.headers, false);

    return this.http.get<T>(finalUrl, { ...options, headers }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * GET for user-independent, CDN-cacheable endpoints (e.g. /config,
   * /supportedLanguages). Sends only the CORS-safelisted Accept header — NO
   * Content-Type and NO session headers — so it is a CORS "simple" GET with no
   * OPTIONS preflight. Required for CloudFront to serve it: a preflighted request
   * can't be edge-served, and during an EP outage the OPTIONS would 499, so the
   * browser would never send the GET and the cached copy would never be used.
   */
  getPublic<T>(endpoint: string, pathParams: { [key: string]: string } = {}, options: ApiRequestOptions = {}): Observable<T> {
    const url = this.generateApiUrl(endpoint, pathParams);
    const finalUrl = this.generateFinalAPIUrl(url);
    const headers = this.getAuthenticatedHeaders(options.headers, false, false);

    return this.http.get<T>(finalUrl, { ...options, headers }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Generic POST request with authentication headers
   */
  post<T, D = unknown>(endpoint: string, data: D, pathParams: { [key: string]: string } = {}, options: ApiRequestOptions = {}): Observable<T> {
    const url = this.generateApiUrl(endpoint, pathParams);
    const finalUrl = this.generateFinalAPIUrl(url);
    const headers = this.getAuthenticatedHeaders(options.headers);

    return this.http.post<T>(finalUrl, data, { ...options, headers }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Generic PUT request
   */
  put<T, D = unknown>(endpoint: string, data: D, pathParams: { [key: string]: string } = {}, options: ApiRequestOptions = {}): Observable<T> {
    const url = this.generateApiUrl(endpoint, pathParams);
    const finalUrl = this.generateFinalAPIUrl(url);
    return this.http.put<T>(finalUrl, data, options).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Generic DELETE request
   */
  delete<T>(endpoint: string, pathParams: { [key: string]: string } = {}, options: ApiRequestOptions = {}): Observable<T> {
    const url = this.generateApiUrl(endpoint, pathParams);
    const finalUrl = this.generateFinalAPIUrl(url);
    return this.http.delete<T>(finalUrl, options).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Handle HTTP errors
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
      const errorBody = error.error as { message?: string } | null;
      if (errorBody?.message) {
        errorMessage = errorBody.message;
      }
    }

    return throwError(() => new Error(errorMessage));
  }

  /**
   * Get authenticated headers matching original app patterns
   * Note: CORS headers are set by the server, not the client
   */
  getAuthenticatedHeaders(customHeaders?: HttpHeaders | { [header: string]: string | string[] }, includeContentType = true, includeSessionHeaders = true): HttpHeaders {
    let headers = new HttpHeaders({
      'Accept': 'application/json;charset=UTF-8'
    });
    // Only attach Content-Type when the request has a body (POST/PUT). On bodyless
    // GETs it is meaningless and, being non-safelisted, would force a CORS preflight.
    if (includeContentType) {
      headers = headers.set('Content-Type', 'application/json;charset=UTF-8');
    }

    // Add Chatbot-Session-Id + X-Krista-Context headers from the stored
    // clientSessionId. The X-Krista-Context envelope is the URI-encoded
    // JSON {clientSessionId: <id>} the server expects. Skipped for user-independent,
    // CDN-cacheable endpoints (see getPublic) so those stay CORS-"simple" (no preflight).
    const sessionId = this.storageService.getClientSessionId();
    if (includeSessionHeaders && sessionId) {
      headers = headers.set('Chatbot-Session-Id', sessionId);
      headers = headers.set('X-Krista-Context',
          encodeURIComponent(JSON.stringify({ clientSessionId: sessionId })));
    }

    // Add custom headers
    if (customHeaders) {
      if (customHeaders instanceof HttpHeaders) {
        customHeaders.keys().forEach(key => {
          const values = customHeaders.getAll(key);
          if (values) {
            headers = headers.set(key, values);
          }
        });
      } else {
        Object.keys(customHeaders).forEach(key => {
          const value = customHeaders[key];
          if (value) {
            headers = headers.set(key, value);
          }
        });
      }
    }

    return headers;
  }
}
