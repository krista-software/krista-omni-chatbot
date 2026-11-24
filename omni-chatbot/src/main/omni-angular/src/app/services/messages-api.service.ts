import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';
import { environment } from '../../environments/environment';
import { MessageDto, MessagesApiResponse } from '../models/api.model';

// Re-export MessageDto for backward compatibility
export type { MessageDto } from '../models/api.model';

export interface MessagesResponse {
  messages: MessageDto[];
  hasMore: boolean;
  nextOffset?: string;
}

export interface GetMessagesParams {
  inboxId: string;
  inclusive?: boolean;
  pageSize?: number;
  offset?: string;
}

type MessageQueryParams = {
  [key: string]: string;
};

interface SubmitMessageData {
  message?: string;
  messageType?: string;
  timestamp?: number;
  [key: string]: unknown;
}

@Injectable({
  providedIn: 'root'
})
export class MessagesApiService {

  constructor(private apiService: ApiService) {}

  /**
   * Get messages for an inbox - matches original app implementation
   * GET /chatbot/inboxes/{inboxId}/messages?inclusive=false&pageSize=20&offset=...
   */
  getMessages(
    inboxId: string,
    options: {
      inclusive?: boolean;
      pageSize?: number;
      offset?: string;
    } = {}
  ): Observable<MessagesResponse> {
    const {
      inclusive = false,
      pageSize = 20,
      offset
    } = options;

    // Build query parameters
    const params: MessageQueryParams = {
      inboxId: inboxId,
      inclusive: inclusive.toString(),
      pageSize: pageSize.toString()
    };

    if (offset) {
      params['offset'] = offset;
    }

    // Replace placeholder in URL template
    const url = environment.apiEndpoints.getMessages.replace('<inboxId>', inboxId);

    return this.apiService.get<MessagesApiResponse | MessageDto[]>(url, {}, { params }).pipe(
      map((response: MessagesApiResponse | MessageDto[]) => {
        // Handle different response formats
        let messages: MessageDto[] = [];
        if (Array.isArray(response)) {
          messages = response;
        } else if (response?.messages && Array.isArray(response.messages)) {
          messages = response.messages;
        } else if (response?.data && Array.isArray(response.data)) {
          messages = response.data;
        }

        const result: MessagesResponse = {
          messages: messages,
          hasMore: messages.length === pageSize,
          nextOffset: messages.length > 0 ? messages[messages.length - 1].id : undefined
        };

        return result;
      }),
      catchError(error => {
        // Don't return mock data - let the error propagate
        throw error;
      })
    );
  }

  /**
   * Get initial messages for an inbox (first page)
   * Matches original app: GET /chatbot/inboxes/{inboxId}/messages?inboxId={inboxId}&inclusive=false&pageSize=20
   */
  getInitialMessages(inboxId: string): Observable<MessagesResponse> {
    return this.getMessages(inboxId, {
      inclusive: false,
      pageSize: 20
    });
  }

  /**
   * Get more messages (pagination)
   * Matches original app: GET /chatbot/inboxes/{inboxId}/messages?inclusive=false&pageSize=20&offset=...
   */
  getMoreMessages(inboxId: string, offset: string): Observable<MessagesResponse> {
    return this.getMessages(inboxId, {
      inclusive: false,
      pageSize: 20,
      offset: offset
    });
  }

  /**
   * Get messages with negative page size (older messages)
   * Matches original app: GET /chatbot/inboxes/{inboxId}/messages?inboxId={inboxId}&offset={messageId}&inclusive=true&pageSize=-20
   */
  getOlderMessages(inboxId: string, offset?: string): Observable<MessagesResponse> {
    return this.getMessages(inboxId, {
      inclusive: true, // Changed to true to match the second API call pattern
      pageSize: -20, // Negative page size for older messages
      offset: offset
    });
  }

  // Removed getNewerMessages - only using the two specific API calls as per requirements

  /**
   * Submit a message to an inbox
   * POST /chatbot/inboxes/{inboxId}/messages/{messageId}
   */
  submitMessage(
    inboxId: string,
    messageId: string,
    messageData: SubmitMessageData
  ): Observable<MessageDto> {
    const pathParams = { inboxId, messageId };

    return this.apiService.post<MessageDto, SubmitMessageData>(
      environment.apiEndpoints.submitMessage,
      messageData,
      pathParams
    ).pipe(
      map(response => response),
      catchError(error => {
        // Don't return mock data - let the error propagate
        throw error;
      })
    );
  }

  /**
   * Send a text message (convenience method)
   */
  sendTextMessage(inboxId: string, message: string): Observable<MessageDto> {
    const messageId = `msg-${Date.now()}`;
    const messageData: SubmitMessageData = {
      message: message,
      messageType: 'text',
      timestamp: Date.now()
    };

    return this.submitMessage(inboxId, messageId, messageData);
  }

  /**
   * Get message by ID
   * GET /chatbot/inboxes/{inboxId}/messages/{messageId}
   */
  getMessageById(inboxId: string, messageId: string): Observable<MessageDto | null> {
    const pathParams = { inboxId, messageId };

    return this.apiService.get<MessageDto>(
      `chatbot/inboxes/<inboxId>/messages/<messageId>`,
      pathParams
    ).pipe(
      catchError(() => of(null))
    );
  }

  /**
   * Delete a message
   * DELETE /chatbot/inboxes/{inboxId}/messages/{messageId}
   */
  deleteMessage(inboxId: string, messageId: string): Observable<boolean> {
    const pathParams = { inboxId, messageId };

    return this.apiService.delete<void>(
      `chatbot/inboxes/<inboxId>/messages/<messageId>`,
      pathParams
    ).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }
}
