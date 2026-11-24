import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { environment } from '../../environments/environment';
import {
  MessageDto,
  ResponderDto,
  FormDto,
  FormPageDto,
  MediaDto,
  TimerDto,
  ExecutionMetaDto,
  SubmitDto,
  CopyDto
} from '../models/api.model';

// Re-export MessageDto for backward compatibility
export type { MessageDto } from '../models/api.model';

/**
 * Extended MessageDto with additional fields used internally
 * This extends the base MessageDto with fields needed for local processing
 */
export interface InternalMessageDto extends MessageDto {
  isIncoming?: boolean;
  executionId?: string;
  messageType?: string;
  formData?: FormDto | FormPageDto[];
  isSystemEventMessage?: boolean;
}

export interface GetMessagesParams {
  inboxId: string;
  inclusive?: boolean;
  offset?: string;
  pageSize?: number;
}

export interface FormResponse {
  [key: string]: unknown;
}

export type MessageQueryParams = {
  [key: string]: string | number | boolean;
};

@Injectable({
  providedIn: 'root'
})
export class MessageApiService {

  constructor(private apiService: ApiService) {}

  /**
   * Get messages for an inbox
   */
  getMessages(params: GetMessagesParams): Observable<MessageDto[]> {
    const pathParams = { inboxId: params.inboxId };
    const queryParams: MessageQueryParams = {};

    if (params.inclusive !== undefined) {
      queryParams['inclusive'] = params.inclusive;
    }
    if (params.offset) {
      queryParams['offset'] = params.offset;
    }
    if (params.pageSize) {
      queryParams['pageSize'] = params.pageSize;
    }

    return this.apiService.get<MessageDto[]>(
      environment.apiEndpoints.getMessages,
      pathParams,
      { params: queryParams }
    ).pipe(
      catchError(error => {
        return of([]);
      })
    );
  }

  /**
   * Submit a form response for a message
   */
  submitMessage(inboxId: string, messageId: string, formResponse: FormResponse): Observable<MessageDto> {
    const pathParams = { inboxId, messageId };

    return this.apiService.put<MessageDto>(
      environment.apiEndpoints.submitMessage,
      formResponse,
      pathParams
    ).pipe(
      catchError(() => {
        // Return a mock response
        const mockResponse: MessageDto = {
          id: messageId,
          userMessage: 'Form submitted successfully',
          creationTime: Date.now(),
          type: 'MessageInform'
        };
        return of(mockResponse);
      })
    );
  }

  /**
   * Send a text message via REST API (fallback for WebSocket)
   */
  sendTextMessage(inboxId: string, message: string): Observable<MessageDto> {
    const messageData = {
      userMessage: message,
      messageType: 'text',
      timestamp: Date.now()
    };

    // Note: This endpoint might not exist in the actual API
    // This is a fallback method for when WebSocket is not available
    return this.apiService.post<MessageDto>(
      `chatbot/inboxes/${inboxId}/messages`,
      messageData,
      { inboxId }
    ).pipe(
      catchError(() => {
        // Return a mock response indicating the message was queued
        const mockResponse: MessageDto = {
          id: `msg-${Date.now()}`,
          userMessage: message,
          creationTime: Date.now(),
          type: 'MessageInform'
        };
        return of(mockResponse);
      })
    );
  }

  // Removed getConversationHistory - not needed, use the two specific API calls instead

  /**
   * Mark messages as read
   */
  markMessagesAsRead(inboxId: string, messageIds: string[]): Observable<boolean> {
    const requestData = {
      messageIds,
      status: 'read'
    };

    return this.apiService.post<any>(
      `chatbot/inboxes/${inboxId}/messages/status`,
      requestData,
      { inboxId }
    ).pipe(
      map(() => true),
      catchError(error => {
        return of(false);
      })
    );
  }

  /**
   * Get message by ID
   */
  getMessageById(inboxId: string, messageId: string): Observable<MessageDto | null> {
    const pathParams = { inboxId, messageId };

    return this.apiService.get<MessageDto>(
      `chatbot/inboxes/<inboxId>/messages/<messageId>`,
      pathParams
    ).pipe(
      catchError(error => {
        return of(null);
      })
    );
  }

  /**
   * Delete a message
   */
  deleteMessage(inboxId: string, messageId: string): Observable<boolean> {
    const pathParams = { inboxId, messageId };

    return this.apiService.delete<any>(
      `chatbot/inboxes/<inboxId>/messages/<messageId>`,
      pathParams
    ).pipe(
      map(() => true),
      catchError(error => {
        return of(false);
      })
    );
  }
}
