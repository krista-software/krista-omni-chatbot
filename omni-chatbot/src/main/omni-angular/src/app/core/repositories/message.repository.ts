import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BaseApiRepository } from './base-api.repository';
import { API_ENDPOINTS } from '../../config/api-endpoints.config';
import {
  MessageDto,
  MessagesApiResponse,
  FormSubmissionPayload
} from '../../models/api.model';

/**
 * Messages response with pagination info
 */
export interface MessagesResponse {
  messages: MessageDto[];
  hasMore: boolean;
  nextOffset?: string;
}

/**
 * Options for fetching messages
 */
export interface GetMessagesOptions {
  inclusive?: boolean;
  pageSize?: number;
  offset?: string;
}

/**
 * Message Repository
 * 
 * Handles all message-related API operations.
 * Follows Repository Pattern to separate data access from business logic.
 */
@Injectable({
  providedIn: 'root'
})
export class MessageRepository extends BaseApiRepository {

  /**
   * Number of messages fetched on the initial history load. Intentionally large:
   * a null offset is paged FORWARD from the caller's server-side READ offset (which
   * the chatbot never advances — no SDK commit API), so a small page caps mid-history
   * and a returning user misses the newest messages. A larger forward page traverses
   * the merged session+child-inbox stream and lands the user on the latest.
   * Band-aid bounded by this value; the proper fix (merged-latest anchor) is
   * platform/kSDK-owned.
   */
  private static readonly INITIAL_PAGE_SIZE = 100;

  constructor(http: HttpClient) {
    super(http);
  }

  /**
   * Get messages for an inbox
   * GET /chatbot/inboxes/{inboxId}/messages
   */
  getMessages(inboxId: string, options: GetMessagesOptions = {}): Observable<MessagesResponse> {
    const { inclusive = false, pageSize = 20, offset } = options;

    const queryParams: Record<string, string> = {
      inboxId,
      inclusive: inclusive.toString(),
      pageSize: pageSize.toString()
    };

    if (offset) {
      queryParams['offset'] = offset;
    }

    return this.get<any>(
      API_ENDPOINTS.MESSAGES.GET_ALL,
      { inboxId },
      queryParams
    ).pipe(
      map(response => this.mapMessagesResponse(response, pageSize))
    );
  }

  /**
   * Get initial messages (first page). See {@link INITIAL_PAGE_SIZE} for why the
   * page is intentionally large.
   */
  getInitialMessages(inboxId: string): Observable<MessagesResponse> {
    return this.getMessages(inboxId, { inclusive: false, pageSize: MessageRepository.INITIAL_PAGE_SIZE });
  }

  /**
   * Get older messages (pagination with negative page size)
   */
  getOlderMessages(inboxId: string, offset?: string): Observable<MessagesResponse> {
    return this.getMessages(inboxId, { inclusive: true, pageSize: -20, offset });
  }

  /**
   * Submit a message
   * POST /chatbot/inboxes/{inboxId}/messages/{messageId}
   */
  submitMessage(inboxId: string, messageId: string, messageData: FormSubmissionPayload): Observable<MessageDto> {
    return this.post<MessageDto>(
      API_ENDPOINTS.MESSAGES.SUBMIT,
      messageData,
      { inboxId, messageId }
    );
  }

  /**
   * Get message by ID
   * GET /chatbot/inboxes/{inboxId}/messages/{messageId}
   */
  getMessageById(inboxId: string, messageId: string): Observable<MessageDto> {
    return this.get<MessageDto>(
      API_ENDPOINTS.MESSAGES.GET_BY_ID,
      { inboxId, messageId }
    );
  }

  /**
   * Delete a message
   * DELETE /chatbot/inboxes/{inboxId}/messages/{messageId}
   */
  deleteMessage(inboxId: string, messageId: string): Observable<void> {
    return this.delete<void>(
      API_ENDPOINTS.MESSAGES.DELETE,
      { inboxId, messageId }
    );
  }

  /**
   * Map API response to MessagesResponse
   */
  private mapMessagesResponse(response: MessagesApiResponse | MessageDto[], pageSize: number): MessagesResponse {
    let messages: MessageDto[] = [];

    if (Array.isArray(response)) {
      messages = response;
    } else if (response?.messages && Array.isArray(response.messages)) {
      messages = response.messages;
    } else if (response?.data && Array.isArray(response.data)) {
      messages = response.data;
    }

    return {
      messages,
      hasMore: messages.length === Math.abs(pageSize),
      nextOffset: messages.length > 0 ? messages[messages.length - 1].id : undefined
    };
  }
}

