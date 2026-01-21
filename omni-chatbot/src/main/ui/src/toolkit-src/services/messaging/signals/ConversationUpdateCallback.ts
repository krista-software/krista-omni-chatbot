import { ExecutionDetail } from "../message/ExecutionDetail";

export interface ConversationUpdateCallback {
  (event: ConversationUpdateEvent, conversationDetail?: ExecutionDetail): void;
}

export enum ConversationUpdateEvent {
  SyncInProgress,
  SyncDone,
  SyncError,
}
