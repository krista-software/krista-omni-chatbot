import axios, { CancelTokenSource } from "axios";
import { ISocketSignalListener } from "../socket/ISocketSignalListener";
import { SocketRequest } from "../socket/SocketRequest";
import { KristaId } from "../../../common/KristaId";
import { consoleLog, isDefined, newGuid } from "../../../common/utils";
import { MessageMeta } from "./MessageMeta";
import {
  ConversationUpdateCallback,
  ConversationUpdateEvent,
} from "./ConversationUpdateCallback";
import { KSDKExecution as Execution } from "../message/KSDKExecution";
import { createAjaxRequest, generateApiUrl } from "../../../api/helpers";
import { GET_CONVERSATION_DETAIL } from "../../../api/endpoints";
import { DbMessages } from "../data-source-repository/DbMessages";
import {
  InboxCallbackResult, NotificationCallbackResult,
  ResultEvent,
} from "../data-source-repository/IMessageDataSource";
import { MessageConstants } from "../MessageConstants";
import { ExecutionDetail } from "../message/ExecutionDetail";
import { KSDKMessage as Message } from "../message/KSDKMessage";
import { ConversationsNetworkDataSource } from "../data-source-repository/ConversationsNetworkDataSource";
import { TimelineNetworkDataSource } from "../data-source-repository/TimelineNetworkDataSource";
import { ConversationSidebars } from "../message/TimelineSidebarInbox";
import { NotificationService } from "../../notification/NotificationService";
import {
  INotificationSignal,
  InboundNotificationType,
  Signal,
  SignalPayload,
} from "../../../types";

export class SyncMessageService implements ISocketSignalListener {
  private static instance: SyncMessageService = new SyncMessageService();

  private readonly dbMessage = DbMessages.getInstance();
  private readonly _hasConversationUpdate = new Set<string>();
  private readonly runningCallAbortMap = new Map<string, CancelTokenSource>();
  private readonly messageUpdateCallbackMap = new Map<
    string,
    {
      workspaceId: KristaId;
      inboxId: KristaId;
      callback: ConversationUpdateCallback;
    }
  >();
  private readonly inboxConversationNetworkSourceMap = new Map<
    string,
    ConversationsNetworkDataSource
  >();
  private readonly inboxConversationSyncCallbackMap = new Map<
    string,
    { inboxId: KristaId; callback: InboxCallbackResult<Execution> }
  >();

  private readonly inboxTimelineNetworkSourceMap = new Map<
    string,
    TimelineNetworkDataSource
  >();
  private readonly inboxTimelineSyncCallbackMap = new Map<
    string,
    { inboxId: KristaId; callback: InboxCallbackResult<Message> }
  >();
  private stateCallback: NotificationCallbackResult | undefined;

  readonly objectId = newGuid();

  private constructor() {
    NotificationService.getInstance().receiveNotification(
      InboundNotificationType.NewMessages,
      this
    );
    NotificationService.getInstance().receiveNotification(
      InboundNotificationType.UpdateMessage,
      this
    );
    NotificationService.getInstance().receiveNotification(
      InboundNotificationType.ExecutionStateUpdateNotification,
      this
    );
  }

  onNotificationSignal(signal: INotificationSignal<InboundNotificationType>) {
    switch (signal.signal) {
      case Signal.notification:
        if (signal.payload.type === InboundNotificationType.NewMessages) {
          this.handleNewMessagesSignal(signal.payload.payload);
        } else if (signal.payload.type === InboundNotificationType.ExecutionStateUpdateNotification) {
          this.handleExecutionStateUpdateSignal(signal.payload.payload);
        } else if (signal.payload.type === InboundNotificationType.UpdateMessage) {
          this.handleMessageUpdateSignal(signal.payload.payload);
        }
        break;
    }
  }

  onSignal(api: string, payload: any, requestContext?: SocketRequest): void {}

  private handleMessageUpdateSignal(payload: any) {
    if (payload && payload.messages && payload.messages.length > 0) {
      const messages = Message.fromJSONArray(payload.messages);
      messages.forEach((message) => {
        if (message) {
          const inboxId = KristaId.parse(payload.inboxId);
          // result is non-empty if the message is present currently
          // if message is not there no need for update or insert
          // it will in drain cycle
          const timelineInboxSidebars =
            this.dbMessage.ensureInboxTimelineSidebar(inboxId);
          const result = timelineInboxSidebars.insertSidebarMessage([message]);

          let conversationSidebar: ConversationSidebars | undefined;
          if (result.sidebarMessages.length > 0) {
            const splitMessage = Message.createSplitMessage(message);
            if (splitMessage) {
              timelineInboxSidebars.insertSidebarMessage([splitMessage]);
            }
            const stepExecutionMeta =
              result.sidebarMessages[result.sidebarMessages.length - 1]
                .executionMeta;
            if (stepExecutionMeta) {
              conversationSidebar = timelineInboxSidebars.getSidebar(
                stepExecutionMeta.executionId
              );
            }
          }

          if (
            result.messages.length > 0 &&
            this.dbMessage.hasMessage(inboxId, message.messageId)
          ) {
            const update: Message[] = [message];
            //check for split, if split possible add in update to mimic drain.
            const splitMessage = Message.createSplitMessage(message);
            if (splitMessage) {
              update.push(splitMessage);
            }
            this.syncUserSentMessage(inboxId, update, conversationSidebar);
          }
          this.handleCopies(message);
        }
      });
    }
  }

  private handleExecutionCopy(executionId: KristaId, message: Message) {
    this.dbMessage.getConversationDetail(executionId)?.updateMessage(message);
  }

  private handleTimelineCopy(inboxId: KristaId, message: Message) {
    // update the message copies if present in target defn inbox
    //check for split, if split possible add in update to mimic drain.
    const dbMessage = this.dbMessage
      .getTimelineTable(inboxId)
      ?.getMessage(message.getId());
    if (dbMessage) {
      dbMessage.update(message);
      const update = [dbMessage];
      const splitMessage = Message.createSplitMessage(dbMessage);
      if (splitMessage) {
        update.push(splitMessage);
      }
      this.syncUserSentMessage(inboxId, update);
    }
  }

  private handleCopies(message: Message) {
    const copies: { [key: string]: string } | undefined = message.copies;
    if (copies) {
      Object.keys(copies).forEach((strInboxId) => {
        const inboxId = KristaId.unwrapInboxId(strInboxId);
        const updatedMessage = message.cloneWithMsgId(
          KristaId.parse(copies[strInboxId])
        );
        if (inboxId.isExecutionId()) {
          this.handleExecutionCopy(inboxId, updatedMessage);
        } else {
          this.handleTimelineCopy(inboxId, updatedMessage);
        }
      });
    }
  }

  private handleNewMessagesSignal(payload: SignalPayload) {
    if (payload) {
      const hasNewMessage = payload.messages && payload.messages.length > 0;
      const inboxId = payload.inboxId;
      const workspaceId = KristaId.parse("workspaceId");
      if (hasNewMessage) {
        this.doSessionTimelineInboxSync(
          workspaceId,
          KristaId.unwrapInboxId(inboxId),
          Message.fromJSONArray(payload.messages || [])
        );
      }
    }
  }

  // private handleNewMessageSignal(payload: any) {
  //   const newMessagesResponse = NewMessagesSocketResponse.fromJSON(payload);
  //   if (newMessagesResponse) {
  //     let hasNewMessage = false;
  //     let hasNewConversation = false;
  //     const workspaceId = newMessagesResponse.workspaceId;
  //     const inboxId = newMessagesResponse.topicInboxId
  //       ? KristaId.unwrapInboxId(newMessagesResponse.topicInboxId)
  //       : KristaId.unwrapInboxId(newMessagesResponse.inboxId);
  //     for (const messageMeta of newMessagesResponse.messageMetaList) {
  //       hasNewMessage = true;
  //       if (messageMeta.stepExecutionMeta) {
  //         this.doSyncConversation(workspaceId, inboxId, messageMeta);
  //         const executionId = messageMeta.stepExecutionMeta?.executionId;
  //         const isNewConversation = !this.dbMessage.hasConversationMessage(
  //           inboxId,
  //           executionId
  //         );
  //         hasNewConversation = isNewConversation || hasNewConversation;
  //         if (isNewConversation) {
  //           this.setHashUpdate(executionId, true);
  //         }
  //       }
  //     }

  //     if (hasNewConversation) {
  //       this.doConversationInboxSync(
  //         workspaceId,
  //         KristaId.unwrapInboxId(inboxId)
  //       );
  //     }
  //     if (hasNewMessage) {
  //       this.doTimelineInboxSync(workspaceId, KristaId.unwrapInboxId(inboxId));
  //     }
  //   }
  // }

  //region conversation detail sync

  private doSyncConversation(
    workspaceId: KristaId,
    inboxId: KristaId,
    messageMeta: MessageMeta
  ) {
    const executionId = messageMeta.stepExecutionMeta?.executionId;
    if (executionId) {
      if (this.dbMessage.hasConversationMessage(inboxId, executionId)) {
        new ConversationsNetworkDataSource(workspaceId, inboxId).getMessages(
          executionId.toString(),
          1,
          1,
          () => {
            consoleLog(
              "Conversation Updated",
              this.dbMessage.getConversationTable(inboxId)
            );
          },
          false,
          true
        );
      }

      if (this.requiredSync(executionId)) {
        this.fetchConversationDetail(workspaceId, inboxId, executionId);
      } else {
        if (this.dbMessage.hasConversationMessage(inboxId, executionId)) {
          this.setHashUpdate(executionId, true);
        }
      }
    }
  }

  private setHashUpdate(executionId: KristaId, hasUpdate: boolean): void {
    if (hasUpdate) {
      this._hasConversationUpdate.add(executionId.toString());
    } else {
      this._hasConversationUpdate.delete(executionId.toString());
    }
  }

  private hasUpdate(executionId: KristaId): boolean {
    return this._hasConversationUpdate.has(executionId.toString());
  }

  private requiredSync(executionId?: KristaId): boolean {
    if (!executionId) {
      return false;
    }
    return isDefined(this.messageUpdateCallbackMap.get(executionId.toString()));
  }

  private updateConversationDetail(
    inboxId: KristaId,
    executionId: KristaId,
    conversationDetail?: ExecutionDetail
  ) {
    const conversationCallback = this.messageUpdateCallbackMap.get(
      executionId.toString()
    );
    this.setHashUpdate(executionId, false);
    if (!conversationDetail) {
      conversationCallback?.callback(ConversationUpdateEvent.SyncError);
    } else {
      this.dbMessage.setConversationDetail(executionId, conversationDetail);
      conversationCallback?.callback(
        ConversationUpdateEvent.SyncDone,
        conversationDetail
      );
    }
  }

  private fetchConversationDetail(
    workspaceId: KristaId,
    inboxId: KristaId,
    executionId: KristaId
  ) {
    const url: string = generateApiUrl(GET_CONVERSATION_DETAIL, {
      workspaceId: workspaceId,
      conversationExecutionId: executionId,
    });
    let cancelTokenSource = this.runningCallAbortMap.get(
      executionId.toString()
    );
    if (cancelTokenSource) {
      cancelTokenSource.cancel();
    }
    cancelTokenSource = axios.CancelToken.source();
    this.runningCallAbortMap.set(executionId.toString(), cancelTokenSource);
    createAjaxRequest({
      url,
      options: { cancelToken: cancelTokenSource.token },
    })
      .then((response) => {
        if (response.data) {
          const detailResponse = ExecutionDetail.fromJSON(
            response.data["payload"]
          );
          this.updateConversationDetail(inboxId, executionId, detailResponse);
        }
      })
      .catch((error) => {
        if (!axios.isCancel(error)) {
          this.updateConversationDetail(inboxId, executionId);
        }
      });
  }

  public registerConversationUpdate(
    workspaceId: KristaId,
    inboxId: KristaId,
    executionId: KristaId,
    callback: ConversationUpdateCallback,
    forceFetch?: boolean
  ) {
    this.messageUpdateCallbackMap.set(executionId.toString(), {
      workspaceId,
      inboxId,
      callback,
    });

    let updateEvent;
    if (this.hasUpdate(executionId) || forceFetch) {
      // fetch the conversation detail
      updateEvent = ConversationUpdateEvent.SyncInProgress;
      this.fetchConversationDetail(workspaceId, inboxId, executionId);
    } else {
      updateEvent = ConversationUpdateEvent.SyncDone;
    }
    //return cached detail
    const conversationDetail =
      this.dbMessage.getConversationDetail(executionId);
    callback(updateEvent, conversationDetail);
  }

  public unregisterConversationUpdate(executionId: KristaId) {
    this.messageUpdateCallbackMap.delete(executionId.toString());
  }

  //endregion

  //region inbox sync conversation/timeline

  //conversation inbox
  private doConversationInboxSync(workspaceId: KristaId, inboxId: KristaId) {
    // consoleLog("MsgSync", "doConversationInboxSync: " + inboxId.toString());
    const pageState = this.dbMessage.getConversationPageState(inboxId);
    if (pageState._atTop) {
      const conversationInboxRequest =
        this.inboxConversationSyncCallbackMap.get(inboxId.toString());
      const callback =
        conversationInboxRequest?.callback ||
        (() => {
          // consoleLog("SyncMessageService-doConversationInboxSync", "Dummy Callback listener: " + inboxId.toString());
        });
      const table = this.dbMessage.getConversationTable(inboxId);
      let networkDataSource = this.inboxConversationNetworkSourceMap.get(
        inboxId.toString()
      );
      if (!networkDataSource) {
        networkDataSource = new ConversationsNetworkDataSource(
          workspaceId,
          inboxId
        );
        this.inboxConversationNetworkSourceMap.set(
          inboxId.toString(),
          networkDataSource
        );
      }
      networkDataSource.getMessages(
        table.lastMessage?.getId(),
        table.lastMessage?.getId()
          ? 0
          : MessageConstants.ConversationDrainDefaultPageSize,
        MessageConstants.ConversationDrainDefaultPageSize,
        callback,
        false,
        true
      );
    }
  }

  public registerConversationInboxSync(
    workspaceId: KristaId,
    inboxId: KristaId,
    callback: InboxCallbackResult<Execution>
  ) {
    let conversationSyncCallbackMap = this.inboxConversationSyncCallbackMap;
    const callBackMeta = conversationSyncCallbackMap.get(inboxId.toString());
    if (!callBackMeta) {
      conversationSyncCallbackMap.set(inboxId.toString(), {
        inboxId: inboxId,
        callback: callback,
      });
    } else {
      callBackMeta.callback = callback;
      conversationSyncCallbackMap.set(inboxId.toString(), callBackMeta);
    }
  }

  public unregisterConversationInboxSync(inboxId: KristaId) {
    this.inboxConversationSyncCallbackMap.delete(inboxId.toString());
  }

  //timeline inbox
  public syncUserSentMessage(
    inboxId: KristaId,
    messages: Message[],
    sidebar?: ConversationSidebars
  ) {
    const table = this.dbMessage.ensureTimelineTable(inboxId);
    const insertUpdate = table.insertAtBottom(messages);
    const inboxRequest = this.inboxTimelineSyncCallbackMap.get(
      inboxId.toString()
    );
    if (inboxRequest) {
      inboxRequest.callback(ResultEvent.UserSentMessage, {
        messages: insertUpdate.insert,
        update: insertUpdate.update,
        sidebars: sidebar,
      });
    }
  }

  private doSessionTimelineInboxSync(
    workspaceId: KristaId,
    inboxId: KristaId,
    newMessages: Message[]
  ) {
    // consoleLog("MsgSync", "doTimelineInboxSync: " + inboxId.toString());
    const pageState = this.dbMessage.ensureTimeLinePageState(inboxId);
    consoleLog(
      "messaging: SyncMessageService: doTimelineInboxSync: getPageStateInfo of",
      inboxId.toString(),
      {
        pageState,
      }
    );
    if (pageState._atTop) {
      const inboxRequest = this.inboxTimelineSyncCallbackMap.get(
        inboxId.toString()
      );
      consoleLog(
        "messaging: SyncMessageService: doTimelineInboxSync: inboxRequest",
        {
          inboxRequest,
        }
      );
      const callback =
        inboxRequest?.callback ||
        (() => {
          // consoleLog("SyncMessageService-doTimelineInboxSync", "Dummy Callback listener: " + inboxId.toString());
        });
      const table = this.dbMessage.ensureTimelineTable(inboxId);
      let networkDataSource = this.inboxTimelineNetworkSourceMap.get(
        inboxId.toString()
      );
      consoleLog(
        "messaging: SyncMessageService: doTimelineInboxSync: networkDataSource",
        {
          networkDataSource,
        }
      );
      if (!networkDataSource) {
        networkDataSource = new TimelineNetworkDataSource(workspaceId, inboxId);
        this.inboxTimelineNetworkSourceMap.set(
          inboxId.toString(),
          networkDataSource
        );
      }
      const result = table.insertAtBottom(newMessages);
      consoleLog(
        "messaging: SyncMessageService: all messages: ",
        table.getAllMessages()
      );
      consoleLog(
        "messaging: SyncMessageService: inboxTimelineSyncCallbackMap callback: ",
        this.inboxTimelineSyncCallbackMap.entries(),
        inboxId.toString()
      );
      if (result.insert.length > 0) {
        this.inboxTimelineSyncCallbackMap
          .get(KristaId.createInboxId(inboxId).toString())
          ?.callback(ResultEvent.Success, { messages: result.insert });
      }
    }
  }

  private doTimelineInboxSync(workspaceId: KristaId, inboxId: KristaId) {
    // consoleLog("MsgSync", "doTimelineInboxSync: " + inboxId.toString());
    const pageState = this.dbMessage.ensureTimeLinePageState(inboxId);
    consoleLog(
      "messaging: SyncMessageService: doTimelineInboxSync: getPageStateInfo of",
      inboxId.toString(),
      {
        pageState,
      }
    );
    if (pageState._atTop) {
      const inboxRequest = this.inboxTimelineSyncCallbackMap.get(
        inboxId.toString()
      );
      consoleLog(
        "messaging: SyncMessageService: doTimelineInboxSync: inboxRequest",
        {
          inboxRequest,
        }
      );
      const callback =
        inboxRequest?.callback ||
        (() => {
          // consoleLog("SyncMessageService-doTimelineInboxSync", "Dummy Callback listener: " + inboxId.toString());
        });
      const table = this.dbMessage.ensureTimelineTable(inboxId);
      let networkDataSource = this.inboxTimelineNetworkSourceMap.get(
        inboxId.toString()
      );
      consoleLog(
        "messaging: SyncMessageService: doTimelineInboxSync: networkDataSource",
        {
          networkDataSource,
        }
      );
      if (!networkDataSource) {
        networkDataSource = new TimelineNetworkDataSource(workspaceId, inboxId);
        this.inboxTimelineNetworkSourceMap.set(
          inboxId.toString(),
          networkDataSource
        );
      }
      consoleLog(
        "messaging: SyncMessageService: all messages: ",
        table.getAllMessages()
      );
      networkDataSource.getMessages(
        table.lastMessage?.getId(),
        table.lastMessage?.getId()
          ? 0
          : MessageConstants.TimelineDrainDefaultPageSize,
        MessageConstants.TimelineDrainDefaultPageSize,
        callback,
        false,
        true
      );
    }
  }

  public registerStateNotification(callback: NotificationCallbackResult) {
    this.stateCallback = callback;
  }

  public registerTimelineInboxSync(
    workspaceId: KristaId,
    inboxId: KristaId,
    callback: InboxCallbackResult<Message>
  ) {
    const timelineSyncCallbackMap = this.inboxTimelineSyncCallbackMap;
    const callBackMeta = timelineSyncCallbackMap.get(inboxId.toString());
    if (!callBackMeta) {
      timelineSyncCallbackMap.set(inboxId.toString(), {
        inboxId: inboxId,
        callback: callback,
      });
    } else {
      callBackMeta.callback = callback;
      timelineSyncCallbackMap.set(inboxId.toString(), callBackMeta);
    }
  }

  public unregisterTimelineInboxSync(inboxId: KristaId) {
    this.inboxTimelineSyncCallbackMap.delete(inboxId.toString());
  }

  //endregion

  /**
   * A static method for getting a singleton instance of SyncMessageService
   * @static
   * @returns {SyncMessageService} A singleton instance of SyncMessageService
   */
  public static getInstance(): SyncMessageService {
    if (!this.instance) {
      this.instance = new SyncMessageService();
    }
    return this.instance;
  }

  private handleExecutionStateUpdateSignal(payload: SignalPayload) {
    if (payload) {
      const state = payload?.state;
      const typing = state === "waiting";

      if (this.stateCallback) {
        this.stateCallback(typing);
      }
    }
  }
}

export class NewMessagesSocketResponse {
  constructor(
    readonly workspaceId: KristaId,
    readonly inboxId: KristaId,
    readonly topicInboxId: KristaId,
    readonly messageMetaList: MessageMeta[]
  ) {}

  static fromJSON(json: any): NewMessagesSocketResponse | undefined {
    if (!isDefined(json)) {
      return undefined;
    }

    return new NewMessagesSocketResponse(
      KristaId.parse(json["workspaceId"]),
      KristaId.parse(json["inboxId"]),
      KristaId.parse(json["topicInboxId"]),
      MessageMeta.fromJSONArray(json["newMessages"])
    );
  }
}
