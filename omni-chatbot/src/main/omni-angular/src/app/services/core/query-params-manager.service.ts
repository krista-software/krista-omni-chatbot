import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, ReplaySubject } from 'rxjs';
import { EXCLUDED_QUERY_PARAMS, POST_MESSAGE_TYPES } from '../../config/constants';
import { PersonAttributesService } from '../person-attributes.service';

/**
 * Query parameters dictionary
 */
type QueryParams = Record<string, string>;

/**
 * Metadata dictionary (can contain various value types)
 */
type Metadata = Record<string, unknown>;

/**
 * PostMessage event data structure
 */
interface PostMessageEventData {
  messageType?: string;
  metadata?: Metadata;
  queryParams?: QueryParams;
}

/**
 * QueryParamsManager Service
 * Manages URL query parameters and postMessage communication
 * Extracted from AppComponent for better separation of concerns
 */
@Injectable({
  providedIn: 'root'
})
export class QueryParamsManagerService {
  private queryParamsSubject = new BehaviorSubject<QueryParams>({});
  private metadataSubject = new BehaviorSubject<Metadata>({});

  public queryParams$ = this.queryParamsSubject.asObservable();
  public metadata$ = this.metadataSubject.asObservable();

  // Emits the combined attributes the FIRST time the host actually delivers
  // them via postMessage (dataToChatbot / chatbotIconClicked) — emitting an
  // empty {} when the host sent no attributes. This is deliberately distinct
  // from queryParams$/metadata$ (which seed with {} immediately): consumers
  // that must order work around the upsert (e.g. AppFacade gating the welcome
  // conversation on the upsert response) need to tell "host delivered nothing"
  // (proceed now) apart from "host hasn't delivered yet" (keep waiting).
  // ReplaySubject(1) so a consumer subscribing after delivery still sees it.
  private attributesDeliveredSubject = new ReplaySubject<Metadata>(1);
  public attributesDelivered$: Observable<Metadata> = this.attributesDeliveredSubject.asObservable();

  constructor(private personAttributesService: PersonAttributesService) {}

  /**
   * Initialize query params extraction and postMessage listener
   */
  initialize(): void {
    this.extractQueryParameters();
    this.setupPostMessageListener();
  }

  /**
   * Get current query parameters
   */
  getQueryParams(): QueryParams {
    return this.queryParamsSubject.value;
  }

  /**
   * Clear query parameters after they've been consumed (e.g., after welcome form auto-fill)
   */
  clearQueryParams(): void {
    this.queryParamsSubject.next({});
  }

  /**
   * Get current metadata
   */
  getMetadata(): Metadata {
    return this.metadataSubject.value;
  }

  /**
   * Get combined attributes (query params + metadata)
   */
  getCombinedAttributes(): Metadata {
    return { ...this.queryParamsSubject.value, ...this.metadataSubject.value };
  }

  /**
   * Extract query parameters from URL (matches original app)
   * original app: lines 56-65 in AuthenticationProvider.tsx
   */
  private extractQueryParameters(): void {
    // Check if we're in an iframe
    const isInIframe = window.self !== window.top;
    // Only extract query params if NOT in iframe (matches original app)
    if (!isInIframe) {
      const params = new URLSearchParams(window.location.search);
      const obj: QueryParams = {};

      params.forEach((value, key) => {
        // Skip excluded parameters
        if (!(EXCLUDED_QUERY_PARAMS as readonly string[]).includes(key)) {
          obj[key] = value;
        }
      });

      this.queryParamsSubject.next(obj);
    }
  }

  /**
   * Filter out excluded parameters from an object
   */
  private filterExcludedParams(params: Metadata | undefined): Metadata {
    const filtered: Metadata = {};

    Object.keys(params || {}).forEach(key => {
      if (!(EXCLUDED_QUERY_PARAMS as readonly string[]).includes(key)) {
        filtered[key] = params?.[key];
      }
    });

    return filtered;
  }

  /**
   * Set up postMessage listener for external communication
   * Matches original app's AuthenticationProvider implementation
   */
  private setupPostMessageListener(): void {
    window.addEventListener('message', (event: MessageEvent<string | object>) => {
      try {
        const eventData = event.data;

        // Skip if data is already an object (not a JSON string)
        if (typeof eventData === 'object') {
          return;
        }

        const eventDataJson = JSON.parse(eventData) as PostMessageEventData;
        const { messageType } = eventDataJson;

        switch (messageType) {
          case POST_MESSAGE_TYPES.CHATBOT_ICON_CLICKED: {
            // To support old launcher.js (matches original app line 74-78)
            const filteredMetadata = this.filterExcludedParams(eventDataJson.metadata);
            this.metadataSubject.next(filteredMetadata);
            this.attributesDeliveredSubject.next(this.getCombinedAttributes());
            break;
          }

          case POST_MESSAGE_TYPES.DATA_TO_CHATBOT: {
            // Matches original app line 80-84
            // Filter excluded params from both metadata and queryParams
            const metadata = this.filterExcludedParams(eventDataJson.metadata);
            const queryParams = this.filterExcludedParams(eventDataJson.queryParams) as QueryParams;

            this.metadataSubject.next(metadata);
            this.queryParamsSubject.next({ ...this.queryParamsSubject.value, ...queryParams });
            this.attributesDeliveredSubject.next(this.getCombinedAttributes());
            break;
          }

          case POST_MESSAGE_TYPES.UPSERT_PERSON_ATTRIBUTES: {
            // Call upsertAttributes when this message type is received
            // Matches original app: case "upsertPersonAttributes": upsertAttributes(eventDataJson.metadata);
            const filteredAttributes = this.filterExcludedParams(eventDataJson.metadata);
            this.upsertAttributes(filteredAttributes);
            break;
          }

          default:
            break;
        }
      } catch {
        // Invalid message format - ignore
      }
    });

    // Send initDone message to parent (matches original app line 99-101)
    // TODO: Add implementation of KR-20138
    setTimeout(() => {
      if (window.parent) {
        window.parent.postMessage(`{"messageType": "${POST_MESSAGE_TYPES.INIT_DONE}"}`, '*');
      }
    }, 1);
  }

  /**
   * Upsert person attributes via API
   * Matches original app's upsertAttributes function in AuthenticationProvider
   */
  private upsertAttributes(attributes: Metadata): void {
    // Skip if no attributes or empty object
    if (!attributes || Object.keys(attributes).length === 0) {
      return;
    }

    // Call the PersonAttributesService to upsert attributes
    this.personAttributesService.upsertPersonAttributes(attributes).subscribe({
      next: () => {
        // Person attributes updated successfully
      },
      error: (error: Error) => {
        console.error('PERSON ATTRIBUTES API FAILED...', error);
      }
    });
  }
}
