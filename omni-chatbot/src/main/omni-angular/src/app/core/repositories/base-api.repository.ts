import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AppConfig } from '../../config/app.config';

/**
 * Base API Repository
 * 
 * Abstract base class for all API repositories. Provides common HTTP methods
 * and URL generation logic. Follows the Repository Pattern to separate
 * data access logic from business logic.
 * 
 * Benefits:
 * - Consistent API access patterns across the application
 * - Centralized URL generation
 * - Easy to mock for testing
 * - Follows Dependency Inversion Principle
 */
export abstract class BaseApiRepository {
  protected readonly baseUrl: string;
  protected readonly routingId: string;

  constructor(protected http: HttpClient) {
    this.baseUrl = environment.apiHost;
    this.routingId = AppConfig.getChatbotRoutingPath();
  }

  /**
   * Generate full API URL from endpoint
   * 
   * @param endpoint - The API endpoint (e.g., 'chatbot/config')
   * @param pathParams - Path parameters to replace (e.g., { inboxId: '123' })
   * @returns Full API URL
   */
  protected generateUrl(endpoint: string, pathParams: Record<string, string> = {}): string {
    let url = endpoint;

    // Replace path parameters
    Object.entries(pathParams).forEach(([key, value]) => {
      url = url.replace(`<${key}>`, encodeURIComponent(value));
    });

    // Handle slash joining
    let finalUrl = url;
    if (this.routingId.endsWith('/') && url.startsWith('/')) {
      finalUrl = url.substring(1);
    } else if (!this.routingId.endsWith('/') && !url.startsWith('/')) {
      finalUrl = `/${url}`;
    }

    // Construct full URL
    if (this.baseUrl) {
      const cleanBaseUrl = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
      return `${cleanBaseUrl}${this.routingId}${finalUrl}`;
    }

    return `${this.routingId}${finalUrl}`;
  }

  /**
   * HTTP GET request
   */
  protected get<T>(
    endpoint: string,
    pathParams: Record<string, string> = {},
    queryParams?: HttpParams | Record<string, string>
  ): Observable<T> {
    const url = this.generateUrl(endpoint, pathParams);
    const params = this.buildHttpParams(queryParams);
    return this.http.get<T>(url, { params });
  }

  /**
   * HTTP POST request
   */
  protected post<T>(
    endpoint: string,
    body: any = {},
    pathParams: Record<string, string> = {},
    queryParams?: HttpParams | Record<string, string>
  ): Observable<T> {
    const url = this.generateUrl(endpoint, pathParams);
    const params = this.buildHttpParams(queryParams);
    return this.http.post<T>(url, body, { params });
  }

  /**
   * HTTP PUT request
   */
  protected put<T>(
    endpoint: string,
    body: any = {},
    pathParams: Record<string, string> = {}
  ): Observable<T> {
    const url = this.generateUrl(endpoint, pathParams);
    return this.http.put<T>(url, body);
  }

  /**
   * HTTP DELETE request
   */
  protected delete<T>(
    endpoint: string,
    pathParams: Record<string, string> = {}
  ): Observable<T> {
    const url = this.generateUrl(endpoint, pathParams);
    return this.http.delete<T>(url);
  }

  /**
   * Build HttpParams from object or return existing HttpParams
   */
  private buildHttpParams(params?: HttpParams | Record<string, string>): HttpParams | undefined {
    if (!params) {
      return undefined;
    }

    if (params instanceof HttpParams) {
      return params;
    }

    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        httpParams = httpParams.set(key, value);
      }
    });

    return httpParams;
  }
}

