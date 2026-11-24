import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

/**
 * HTTP Interceptor for centralized error handling
 * 
 * This interceptor:
 * - Catches all HTTP errors
 * - Logs errors for debugging
 * - Transforms errors into a consistent format
 * - Can be extended to handle specific error codes (401, 403, 500, etc.)
 */
@Injectable()
export class ErrorInterceptor implements HttpInterceptor {

  constructor() {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        return this.handleError(error, request);
      })
    );
  }

  /**
   * Handle HTTP errors with consistent error formatting.
   * 429 is re-thrown as the original HttpErrorResponse so callers
   * (AdmissionService) can read the queue body directly.
   */
  private handleError(error: HttpErrorResponse, request: HttpRequest<unknown>): Observable<never> {
    if (error.status === 429) {
      return throwError(() => error);
    }

    let errorMessage = 'An unknown error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side error (network error, etc.)
      errorMessage = `Network Error: ${error.error.message}`;
      console.error('Client-side error:', error.error.message);
    } else {
      // Server-side error
      errorMessage = this.getServerErrorMessage(error);
      console.error(`Server error [${error.status}]:`, errorMessage, {
        url: request.url,
        method: request.method
      });

      // Handle specific error codes
      this.handleSpecificErrors(error);
    }

    return throwError(() => ({
      status: error.status,
      message: errorMessage,
      originalError: error
    }));
  }

  /**
   * Extract meaningful error message from server response
   */
  private getServerErrorMessage(error: HttpErrorResponse): string {
    // Try to get message from error body
    if (error.error) {
      if (typeof error.error === 'string') {
        return error.error;
      }
      if (error.error.message) {
        return error.error.message;
      }
      if (error.error.error) {
        return error.error.error;
      }
    }

    // Fallback to status text
    switch (error.status) {
      case 400:
        return 'Bad Request: The server could not understand the request.';
      case 401:
        return 'Unauthorized: Please log in to continue.';
      case 403:
        return 'Forbidden: You do not have permission to access this resource.';
      case 404:
        return 'Not Found: The requested resource was not found.';
      case 500:
        return 'Internal Server Error: Something went wrong on the server.';
      case 502:
        return 'Bad Gateway: The server received an invalid response.';
      case 503:
        return 'Service Unavailable: The server is temporarily unavailable.';
      default:
        return `Error ${error.status}: ${error.statusText || 'Unknown error'}`;
    }
  }

  /**
   * Handle specific error codes with custom logic
   * Can be extended to trigger auth refresh, redirect, etc.
   */
  private handleSpecificErrors(error: HttpErrorResponse): void {
    switch (error.status) {
      case 401:
        // Could trigger auth refresh or redirect to login
        // For now, just log
        console.warn('Authentication required - session may have expired');
        break;
      case 403:
        // Could show permission denied message
        console.warn('Permission denied for this resource');
        break;
      case 500:
      case 502:
      case 503:
        // Could trigger retry logic or show maintenance message
        console.warn('Server error - may need to retry');
        break;
    }
  }
}

