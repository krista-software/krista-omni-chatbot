export interface KSDKMessage {
  id: string;
  uniqueKey: string;
  userMessage?: string;
  message?: string;
  isIncoming: boolean;
  isSystemEventMessage?: boolean;
  systemEventType?: string;
  systemEventData?: {
    account: {
      name: string;
    };
  };
  sender?: {
    id: string;
    name: string;
  };
  authentication?: {
    authUrl: string;
    systemName: string;
  };
  responder?: any;
  form?: MessageForm;
  media?: MessageMedia;
  timer?: MessageTimer;
  messageType?: MessageType;
  submit?: {
    type: SubmitType;
    value?: string;
  };
  executionId: string;
  executionMeta?: {
    executionId: string;
    title: string;
  };
  paths?: string[];
  sideConversations?: string[];
  getCreationTime(): number;
  getId(): string;
}

export interface KSDKIMessage {
  getId(): string;
  getCreationTime(): number;
}

export enum SubmitType {
  submit = 'submit',
  sidebar = 'sidebar',
  path = 'path',
  no_answer = 'no_answer'
}

export enum MessageType {
  TEXT = 'TEXT',
  FORM = 'FORM',
  SYSTEM = 'SYSTEM',
  ASK = 'MessageAsk',
  INFORM = 'MessageInform',
  ANSWERED = 'MessageAnswered',
  RESPONSE_ACK = 'MessageResponseAck'
}

// Additional interfaces for enhanced functionality
export interface MessageTimer {
  startTime: number;
  endTime: number;
}

export interface MessageForm {
  pages: FormPage[];
  readOnly?: boolean;
  hideForm?: boolean;
  paths?: string[];
  sidebars?: string[];
  submittedPath?: string;
  isSubmitted?: boolean;
  noAnswer?: boolean;
  errorFields?: string[];
  errorMessages?: string[];
}

export interface FormPage {
  title?: string;
  fields: FormField[];
}

export interface FormField {
  fieldId?: string; // Optional for backward compatibility, toolkit uses this
  name: string;
  displayName?: string; // Optional display name for sub-fields (e.g., "Phone1" instead of "Multi field1.Phone1")
  fieldType: string;
  value?: any;
  required?: boolean;
  readOnly?: boolean;
  attributeValues?: { [key: string]: any };
  options?: { [key: string]: any };
}

export interface FormResponse {
  values: { [key: string]: any };
  submitType: SubmitType;
  submitValue: string;
}

// Re-export field types from centralized location for backward compatibility
// New code should import directly from '@app/config/field-types.constant'
export { FieldTypes, FIELD_TYPES } from '../config/field-types.constant';
export type { FieldType, FieldTypeKey } from '../config/field-types.constant';

export interface SystemEventData {
  account?: {
    name: string;
    id: string;
  };
}

export interface MessageMedia {
  mediaId?: string;
  url?: string;
  type?: string;
}
