/**
 * Message-related types and enums
 * Mirrors original toolkit-src/services/messaging/message/
 */

export enum MessageType {
  Ask = "MessageAsk",
  Inform = "MessageInform",
  Answered = "MessageAnswered",
  ResponseAck = "MessageResponseAck",
}

export enum SubmitType {
  submit = 'submit',
  sidebar = 'sidebar',
  path = 'path',
  no_answer = 'no_answer'
}

export type AuthMessage = {
  authUrl: string;
  systemName: string;
};

export type SystemEventType = "join-task" | "leave-task";

export type SystemEventData = {
  account: {
    name: string;
    _id: string;
  };
  activeParticipantCounts: number;
};

export interface KSDKAccount {
  id: string;
  name: string;
}

export interface KSDKExecutionMeta {
  executionId: string;
  title: string;
  executionMode?: string;
}

export interface KSDKMedia {
  mediaId?: string;
  url?: string;
  type?: string;
  fileName?: string;
  length?: number;
  width?: number;
  height?: number;
  blurImage?: string;
}

export interface KSDKMessageSubmit {
  type: string;
  value?: string;
}

export interface KSDKTargetAudience {
  // Define as needed
}

export interface KSDKTimer {
  startTime: number;
  endTime: number;
}

export interface Responder {
  sidebars?: string[];
  name?: string;
}

// Form-related interfaces (simplified for now)
export interface KSDKForm {
  pages: FormPage[];
  readOnly?: boolean;
  hideForm?: boolean;
  paths?: string[];
  sidebars?: string[];
  submittedPath?: string;
  isSubmitted?: boolean;
  noAnswer?: boolean;
}

export interface FormPage {
  title?: string;
  fields: FormField[];
}

export interface FormField {
  fieldId: string;
  fieldType: string;
  name: string; // Field name (required for compatibility with Angular components)
  displayName?: string; // Optional display name for sub-fields (e.g., "Phone1" instead of "Multi field1.Phone1")
  label?: string;
  value?: any;
  required?: boolean;
  readOnly?: boolean;
  options?: any;
  attributeValues?: any;
}

