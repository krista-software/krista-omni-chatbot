import { KSDKIMessage as IMessage } from "../message/KSDKIMessage";
import { KristaId } from "../../../common/KristaId";
import { ConversationSidebars } from "../message/TimelineSidebarInbox";

export interface IMessageDataSource<T extends IMessage> {
  readonly workspaceId: KristaId;
  readonly inboxId: KristaId;

  getMessages(
    offsetMessageId: string | undefined,
    before: number,
    after: number,
    callback: InboxCallbackResult<T>,
    inclusive?: boolean,
    forceSync?: boolean
  ): void;

  close(): void;
}

export interface InboxCallbackResult<T extends IMessage> {
  (event: ResultEvent, result: Result<T>): void;
}

export interface NotificationCallbackResult {
  (state: boolean): void;
}

export interface Result<T> {
  messages: T[];
  update?: T[];
  sidebars?: ConversationSidebars;
}

export enum ResultEvent {
  Success,
  Reach_Bottom, // data with, reach end event
  Reach_Top, // data with, reach the top event
  UserSentMessage,
  MessageUpdate, // when existing message updated and no new message
  No_Data,
  OtherRequestInProgress,
}
