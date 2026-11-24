import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { ApiService } from './api.service';
import { environment } from '../../environments/environment';
import { EntitySearchDto, EntitySearchResponse, EntitySearchResult, EntityValue } from '../models/entity.model';
import { FormField } from '../models/message.model';

/**
 * Raw entity search API response
 */
interface RawEntitySearchResponse {
  status?: 'success' | 'error' | 'authentication';
  authentication?: {
    invokerName?: string;
    authUrl?: string;
  };
  error?: string;
  errorMessage?: string;
  result?: RawEntityItem[];
  results?: RawEntityItem[];
  hasMore?: boolean;
}

/**
 * Raw entity item from API
 */
interface RawEntityItem {
  meta?: Record<string, unknown>;
  fields?: Record<string, unknown>;
}

/**
 * Entity search request payload
 */
interface EntitySearchPayload {
  sourceField: SerializedFormField;
  filterFieldName: string;
  value: string;
  page: number;
  count: number;
}

/**
 * Serialized form field for API
 */
interface SerializedFormField {
  name?: string;
  fieldType?: string;
  attributeValues?: {
    entityDefinition?: {
      fields?: Record<string, unknown>;
    };
    filters?: unknown;
    alwaysSynthesizeInTestMode?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Service for searching and selecting entities
 */
@Injectable({
  providedIn: 'root'
})
export class EntitySearchService {
  private cancelSubject = new Subject<void>();

  constructor(private apiService: ApiService) {}

  /**
   * Search for entities based on search criteria
   */
  searchEntities(searchDto: EntitySearchDto): Observable<EntitySearchResponse> {
    // Backend endpoint is at: @Path("/entities/search") in ChatBotResource.
    // Goes through ApiService so the URL is built from the server-injected
    // window.basePath (correct routing id + node prefix — a hand-rolled
    // /extension/api/<id>/ path 404s at nginx) and the session headers are
    // attached like every other API call.
    const payload: EntitySearchPayload = {
      sourceField: this.serializeField(searchDto.sourceField),
      filterFieldName: searchDto.filterFieldName,
      value: searchDto.value,
      page: searchDto.page,
      count: searchDto.count
    };

    const request = this.apiService.post<RawEntitySearchResponse, EntitySearchPayload>(
      environment.apiEndpoints.searchEntities, payload);

    return new Observable(observer => {
      const subscription = request.subscribe({
        next: (response: RawEntitySearchResponse) => {
          // Transform response to EntitySearchResponse format
          const transformedResponse = this.transformResponse(response);
          observer.next(transformedResponse);
          observer.complete();
        },
        error: (error: Error) => {
          // ApiService.handleError already extracts the server message into error.message
          observer.next({
            status: 'error',
            errorMessage: error.message || 'Failed to search entities'
          });
          observer.complete();
        }
      });

      // Handle cancellation
      const cancelSubscription = this.cancelSubject.subscribe(() => {
        subscription.unsubscribe();
        observer.complete();
      });

      return () => {
        subscription.unsubscribe();
        cancelSubscription.unsubscribe();
      };
    });
  }

  /**
   * Cancel ongoing search request
   */
  cancelSearch(): void {
    this.cancelSubject.next();
  }

  /**
   * Transform backend response to EntitySearchResponse format
   */
  private transformResponse(response: RawEntitySearchResponse): EntitySearchResponse {
    // Check if response requires authentication
    if (response.status === 'authentication' || response.authentication) {
      return {
        status: 'authentication',
        authentication: {
          invokerName: response.authentication?.invokerName || '',
          authUrl: response.authentication?.authUrl || ''
        }
      };
    }

    // Check for error
    if (response.status === 'error' || response.error) {
      return {
        status: 'error',
        errorMessage: response.errorMessage || response.error || 'Unknown error'
      };
    }

    // Success response - check for 'result' (singular) vs 'results' (plural)
    const resultArray = response.result || response.results || [];

    // Backend returns items with structure: { meta: {...}, fields: {...} }
    // We need to transform to: { value: { meta: {...}, fields: {...}, textSummary: "..." }, textSummary: "...", fields: [...] }
    const results: EntitySearchResult[] = resultArray.map((item: RawEntityItem) => {
      // Generate text summary from fields
      const textSummary = this.generateTextSummary(item.fields);

      // Transform to EntityValue format
      const entityValue: EntityValue = {
        meta: item.meta || {},
        fields: item.fields || {},
        textSummary: textSummary
      };

      // Convert fields object to array for display (as FormField-like objects)
      const fieldsArray: FormField[] = Object.entries(item.fields || {}).map(([name, value]) => ({
        name,
        fieldType: 'TextField',
        displayName: name,
        value
      }));

      return {
        value: entityValue,
        textSummary: textSummary,
        fields: fieldsArray
      };
    });

    return {
      status: 'success',
      data: {
        results,
        hasMore: response.hasMore || false
      }
    };
  }

  /**
   * Generate text summary from entity fields
   */
  private generateTextSummary(fields: Record<string, unknown> | undefined): string {
    if (!fields) return '';

    // Get all field values that are simple types (string, number, boolean)
    const values: string[] = [];
    for (const [key, value] of Object.entries(fields)) {
      // Skip primaryKey and complex objects
      if (key === 'primaryKey' || typeof value === 'object') continue;

      if (value !== null && value !== undefined && value !== '') {
        values.push(String(value));
      }
    }

    // Join first few values
    return values.slice(0, 3).join(' • ');
  }

  /**
   * Serialize FormField to JSON for API request
   * Matches original implementation: KSDKFormField.toJSON() returns the entire source object
   */
  private serializeField(field: FormField): SerializedFormField {
    // Deep clone the field to avoid modifying the original
    const serialized: SerializedFormField = JSON.parse(JSON.stringify(field));

    // Standalone Selection field: entity attributes live at the top level.
    this.normalizeEntityAttributes(serialized.attributeValues);

    // Table field: the entity attributes live on the nested meta.entity field
    // (the backend's table branch extracts meta.entity itself). The same
    // EntitySelectorMetaParser mutation applies to it (fields object -> array,
    // by reference), so it needs the same normalization back.
    const tableMeta = serialized.attributeValues?.['meta'] as
        { entity?: { attributeValues?: { [key: string]: any } } } | undefined;
    this.normalizeEntityAttributes(tableMeta?.entity?.attributeValues);

    return serialized;
  }

  /**
   * Normalizes an entity field's attributeValues for the backend:
   * - entityDefinition.fields must be an OBJECT keyed by field name (the backend
   *   Gson-parses it into a Map). EntitySelectorMetaParser converts it to an
   *   array IN PLACE for frontend use, so it must be converted back.
   * - filters / alwaysSynthesizeInTestMode are frontend-only metadata that
   *   cause parsing errors backend-side.
   * Mutates the given (already deep-cloned) attributes in place.
   */
  private normalizeEntityAttributes(attributes: { [key: string]: any } | undefined): void {
    if (!attributes) {
      return;
    }

    const entityDefinition = attributes['entityDefinition'];
    if (entityDefinition && Array.isArray(entityDefinition.fields)) {
      const fieldsObject: Record<string, unknown> = {};
      entityDefinition.fields.forEach((fieldItem: { name?: string }) => {
        if (fieldItem.name) {
          fieldsObject[fieldItem.name] = fieldItem;
        }
      });
      entityDefinition.fields = fieldsObject;
    }

    if (attributes['filters']) {
      delete attributes['filters'];
    }
    if (attributes['alwaysSynthesizeInTestMode'] !== undefined) {
      delete attributes['alwaysSynthesizeInTestMode'];
    }
  }

  /**
   * Create entity search DTO
   */
  createSearchDto(
    sourceField: FormField,
    filterFieldName: string,
    searchValue: string,
    page: number,
    pageSize: number
  ): EntitySearchDto {
    return {
      sourceField,
      filterFieldName,
      value: searchValue,
      page,
      count: pageSize
    };
  }
}

