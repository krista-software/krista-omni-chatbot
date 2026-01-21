import { KSDKExecution as Execution } from "../message/KSDKExecution";
import { KristaId } from "../../../common/KristaId";
import { MessageTable } from "./MessageTable";
import { CacheMessageDataSource } from "./CacheMessageDataSource";
import { isDefined, newGuid } from "../../../common/utils";
import { KSDKIMessage as IMessage } from "../message/KSDKIMessage";
import { ExecutionDetail } from "../message/ExecutionDetail";
import { KSDKMessage as Message } from "../message/KSDKMessage";
import {
  ConversationSidebars,
  TimelineSidebarInbox,
} from "../message/TimelineSidebarInbox";

export class DbMessages {
  private static instance: DbMessages = new DbMessages();

  //region conversations view state variables
  private readonly inboxExecutionMap = new Map<
    string,
    MessageTable<Execution>
  >();
  private readonly executionInboxNetworkPageInfo = new Map<
    string,
    InboxStateInfo
  >();
  private readonly executionDetailMap = new Map<string, ExecutionDetail>();
  //endregion

  //region timeline view state variables
  private readonly inboxTimelineMap = new Map<string, MessageTable<Message>>();
  private readonly inboxTimelineSidebarMap = new Map<
    string,
    TimelineSidebarInbox
  >(); //inbox / execution map
  private readonly timelineInboxNetworkPageInfo = new Map<
    string,
    InboxStateInfo
  >();
  //endregion

  readonly objectId = newGuid();

  private constructor() {}

  //region conversation inbox
  public setConversationDetail(
    executionId: string | KristaId,
    conversationDetail: ExecutionDetail
  ) {
    const strExeId =
      executionId instanceof KristaId ? executionId.toString() : executionId;
    return this.executionDetailMap.set(strExeId, conversationDetail);
  }

  public getConversationDetail(
    executionId: string | KristaId
  ): ExecutionDetail | undefined {
    const strExeId =
      executionId instanceof KristaId ? executionId.toString() : executionId;
    return this.executionDetailMap.get(strExeId);
  }

  public removeConversationDetail(executionId: string | KristaId) {
    const strExeId =
      executionId instanceof KristaId ? executionId.toString() : executionId;
    return this.executionDetailMap.delete(strExeId);
  }

  hasConversationMessage(inbox: KristaId, messageId: KristaId): boolean {
    const conversationTable = this.getConversationTable(inbox);
    return isDefined(conversationTable.getMessage(messageId.toString()));
  }

  public createConversationDataSource(
    workspaceId: KristaId,
    inboxId: KristaId
  ): CacheMessageDataSource<Execution> {
    const table = this.getConversationTable(inboxId);
    return new CacheMessageDataSource<Execution>(workspaceId, inboxId, table);
  }

  getConversationTable(inboxId: KristaId): MessageTable<Execution> {
    let table = this.inboxExecutionMap.get(inboxId.toString());
    if (!table) {
      table = new MessageTable<Execution>(inboxId.toString());
      this.inboxExecutionMap.set(inboxId.toString(), table);
    }
    return table;
  }

  deleteConversationTable(inboxId: KristaId) {
    this.inboxExecutionMap.delete(inboxId.toString());
    this.executionInboxNetworkPageInfo.delete(inboxId.toString());
  }

  getConversationPageState(inboxId: KristaId): InboxStateInfo {
    let pageState = this.executionInboxNetworkPageInfo.get(inboxId.toString());
    if (!pageState) {
      pageState = new InboxStateInfo(false, false);
      this.executionInboxNetworkPageInfo.set(inboxId.toString(), pageState);
    }
    return pageState;
  }

  //endregion

  //region timeline inbox
  public createTimelineDataSource(
    workspaceId: KristaId,
    inboxId: KristaId
  ): CacheMessageDataSource<Message> {
    const table = this.ensureTimelineTable(inboxId);
    return new CacheMessageDataSource<Message>(workspaceId, inboxId, table);
  }

  hasMessage(inbox: KristaId, messageId: string): boolean {
    const messageTable = this.getTimelineTable(inbox);
    return isDefined(messageTable?.getMessage(messageId.toString()));
  }

  ensureTimelineTable(inboxId: KristaId): MessageTable<Message> {
    let table = this.getTimelineTable(inboxId);
    if (!table) {
      table = new MessageTable<Message>(inboxId.toString());
      this.inboxTimelineMap.set(inboxId.toString(), table);
    }
    return table;
  }

  getTimelineTable(inboxId: KristaId): MessageTable<Message> | undefined {
    inboxId = KristaId.unwrapInboxId(inboxId);
    return this.inboxTimelineMap.get(inboxId.toString());
  }

  ensureInboxTimelineSidebar(inboxId: KristaId) {
    let timelineSidebar = this.inboxTimelineSidebarMap.get(inboxId.toString());
    if (!timelineSidebar) {
      timelineSidebar = new TimelineSidebarInbox(inboxId);
      this.inboxTimelineSidebarMap.set(inboxId.toString(), timelineSidebar);
    }
    return timelineSidebar;
  }

  getSidebar(inboxId: KristaId, executionId: string): ConversationSidebars {
    let timelineInboxSidebars = this.ensureInboxTimelineSidebar(inboxId);
    return timelineInboxSidebars.getSidebar(executionId);
  }

  deleteTimeLineTable(inboxId: KristaId) {
    this.inboxTimelineMap.delete(inboxId.toString());
    this.timelineInboxNetworkPageInfo.delete(inboxId.toString());
    this.inboxTimelineSidebarMap.delete(inboxId.toString());
  }

  ensureTimeLinePageState(inboxId: KristaId): InboxStateInfo {
    let pageState = this.timelineInboxNetworkPageInfo.get(inboxId.toString());
    if (!pageState) {
      pageState = new InboxStateInfo(false, false);
      this.timelineInboxNetworkPageInfo.set(inboxId.toString(), pageState);
    }
    return pageState;
  }

  //endregion

  /**
   * A static method for getting a singleton instance of DbMessages
   * @static
   * @returns {DbMessages} A singleton instance of DbMessages
   */
  public static getInstance(): DbMessages {
    if (!this.instance) {
      this.instance = new DbMessages();
    }
    return this.instance;
  }

  public static findIndex(messages: IMessage[], messageId: string): number {
    if (!messages) {
      return -1;
    }
    return messages.findIndex((message) => message.getId() === messageId);
  }
}

export class InboxStateInfo {
  readonly objectId = KristaId.generateUUID();

  constructor(public _atTop: boolean, public _atBottom: boolean) {}
}
