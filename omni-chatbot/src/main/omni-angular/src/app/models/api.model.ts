/**
 * API Data Transfer Objects (DTOs)
 *
 * These interfaces define the shape of data received from and sent to the backend API.
 * They replace 'any' types throughout the codebase for better type safety.
 */

// ============================================================================
// Message DTOs
// ============================================================================

/**
 * Message DTO received from the backend API
 */
export interface MessageDto {
  id: string;
  type?: MessageDtoType;
  inboxId?: string;
  sessionId?: string;
  creationTime?: number;
  userMessage?: string;
  message?: string;
  sender?: SenderDto;
  form?: FormDto | FormPageDto[];
  media?: MediaDto;
  submit?: SubmitDto;
  executionMeta?: ExecutionMetaDto;
  paths?: string[];
  sideConversations?: string[];
  timer?: TimerDto;
  responder?: ResponderDto;
  authentication?: AuthenticationDto;
  systemEventType?: string;
  systemEventData?: SystemEventDataDto;
  copies?: CopyDto[];
  targetAudience?: string;
  isSessionTimeout?: boolean; // True when message indicates session timeout - hide footer
  informStepType?: 'standard' | 'status' | 'test';
  statusMessages?: string[];
}

/**
 * Message type strings from backend
 */
export type MessageDtoType =
  | 'MessageInform'
  | 'MessageAsk'
  | 'MessageAnswered'
  | 'MessageResponseAck';

/**
 * Sender information
 */
export interface SenderDto {
  id: string;
  name: string;
}

/**
 * Form data structure from backend
 */
export interface FormDto {
  pages: FormPageDto[];
  readOnly?: boolean;
  hideForm?: boolean;
}

/**
 * Form page structure
 */
export interface FormPageDto {
  title?: string;
  fields: FormFieldDto[];
}

/**
 * Form field structure from backend
 */
export interface FormFieldDto {
  name: string;
  fieldType: string;
  displayLabel?: string; // Backend sends displayLabel (not displayName)
  displayName?: string; // Keep for backward compatibility
  value?: unknown;
  options?: FieldOptionsDto;
  attributeValues?: Record<string, unknown>;
}

/**
 * Field options from backend
 */
export interface FieldOptionsDto {
  required?: { value: boolean };
  readOnly?: { value: boolean };
  maxLength?: { value: number };
  minLength?: { value: number };
  pattern?: { value: string };
  [key: string]: unknown;
}

/**
 * Media attachment
 */
export interface MediaDto {
  mediaId?: string;
  url?: string;
  type?: string;
  fileName?: string;
  fileSize?: number;
}

/**
 * Submit information
 */
export interface SubmitDto {
  type: 'submit' | 'path' | 'sidebar' | 'no_answer';
  value?: string;
}

/**
 * Execution metadata
 */
export interface ExecutionMetaDto {
  executionId: string;
  title?: string;
}

/**
 * Timer information
 */
export interface TimerDto {
  startTime: number;
  endTime: number;
}

/**
 * Responder information
 */
export interface ResponderDto {
  id?: string;
  name?: string;
  type?: string;
}

/**
 * Authentication requirement
 */
export interface AuthenticationDto {
  authUrl: string;
  systemName?: string;
  invokerName?: string;
}

/**
 * System event data
 */
export interface SystemEventDataDto {
  account?: {
    id: string;
    name: string;
  };
}

/**
 * Message copy information
 */
export interface CopyDto {
  id: string;
  inboxId: string;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Messages list response
 */
export interface MessagesApiResponse {
  messages?: MessageDto[];
  data?: MessageDto[];
  hasMore?: boolean;
  nextOffset?: string;
}

// ============================================================================
// Outbound Message Types (sent to backend)
// ============================================================================

/**
 * Outbound message payload for WebSocket
 */
export interface OutboundMessagePayload {
  sessionId: string;
  id: string;
  inboxId: string;
  type: string;
  sender: SenderDto;
  message: string;
}

/**
 * Form submission payload
 */
export interface FormSubmissionPayload {
  targetMessageId: string;
  creationTime: number;
  submitType: string;
  submitValue: string;
  fieldValues: Record<string, unknown> | null;
}

// ============================================================================
// Authentication DTOs
// ============================================================================

/**
 * Authentication data returned from Authenticator.login()
 */
export interface AuthData {
  accountId: string;
  name: string;
  clientSessionId: string;
  kristaAccountId?: string;
  inboxId?: string;
  extras?: AuthExtras;
}

/**
 * Extra authentication data
 */
export interface AuthExtras {
  newSession?: boolean;
  /**
   * true when the login response already carries the real OmniChannel session inbox
   * (inbox_S_…) — pool-served / Faster Startup logins. The SPA can then open the
   * WebSocket using AuthData.inboxId and skip the POST /session round-trip.
   */
  sessionReady?: boolean;
  /**
   * Which server path produced this session: 'pool' (pre-warmed / Faster Startup),
   * 'fresh' (guest provisioned this request), or 'returning' (existing user). Purely
   * observability — surfaced so tooling can report the pool-vs-fresh split.
   */
  servedFrom?: 'pool' | 'fresh' | 'returning';
  [key: string]: unknown;
}

/**
 * Language option from API
 */
export interface LanguageOption {
  code: string;
  name: string;
  flag?: string;
}
