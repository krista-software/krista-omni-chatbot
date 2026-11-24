import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';
import { environment } from '../../environments/environment';

export interface PersonAttributes {
  accountId?: string;
  name?: string;
  email?: string;
  workspaceId?: string;
  contactId?: string;
  language?: string;
  timezone?: string;
  [key: string]: any;
}

export interface PersonAttributesResponse {
  success: boolean;
  contactId?: string;
  workspaceId?: string;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PersonAttributesService {

  constructor(
    private apiService: ApiService,
    private storageService: StorageService
  ) {}

  /**
   * Upsert person attributes
   */
  upsertPersonAttributes(attributes: PersonAttributes): Observable<PersonAttributesResponse> {
    // Drop null/undefined values before sending. The server ignores null-valued
    // attributes anyway, so a payload like {SOURCE: null} persists nothing —
    // firing it is a wasted (CORS-preflighted) round-trip. When nothing
    // meaningful remains, skip the HTTP call entirely.
    const meaningfulAttributes = this.stripNullValues(attributes);
    if (Object.keys(meaningfulAttributes).length === 0) {
      return of({ success: true, message: 'No attributes to upsert' });
    }
    return this.apiService.post<PersonAttributesResponse>(
      environment.apiEndpoints.personAttributes,
      meaningfulAttributes
    ).pipe(
      tap(response => {
        if (response.success) {
          // Store important attributes locally
          if (response.contactId) {
            this.storageService.setMyContactId(response.contactId);
          }
          if (response.workspaceId) {
            this.storageService.setWorkspaceId(response.workspaceId);
          }
          if (attributes.name) {
            this.storageService.setName(attributes.name);
          }
        }
      }),
      catchError(error => {
        // Return a mock success response for development
        const mockResponse: PersonAttributesResponse = {
          success: true,
          contactId: `contact-${Date.now()}`,
          workspaceId: `workspace-${Date.now()}`,
          message: 'Attributes updated (offline mode)'
        };

        // Store mock data locally
        if (mockResponse.contactId) {
          this.storageService.setMyContactId(mockResponse.contactId);
        }
        if (mockResponse.workspaceId) {
          this.storageService.setWorkspaceId(mockResponse.workspaceId);
        }
        if (attributes.name) {
          this.storageService.setName(attributes.name);
        }

        return of(mockResponse);
      })
    );
  }

  /**
   * Returns a copy of the attributes with null/undefined values removed.
   */
  private stripNullValues(attributes: PersonAttributes): PersonAttributes {
    const result: PersonAttributes = {};
    Object.keys(attributes || {}).forEach(key => {
      const value = attributes[key];
      if (value !== null && value !== undefined) {
        result[key] = value;
      }
    });
    return result;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const contactId = this.storageService.getMyContactId();
    const name = this.storageService.getName();
    return !!(contactId && name);
  }
}
