import { PageDataSource } from "./PageDataSource";
import { KristaId } from "../../../common/KristaId";
import { ConversationsNetworkDataSource } from "./ConversationsNetworkDataSource";
import { DbMessages } from "./DbMessages";
import { KSDKExecution } from "../message/KSDKExecution";
import { ConversationMergeDataSource } from "./ConversationMergeDataSource";
import { MessageConstants } from "../MessageConstants";
import { KSDKMessage as Message } from "../message/KSDKMessage";
import { TimelineMergeDataSource } from "./TimelineMergeDataSource";
import { TimelineNetworkDataSource } from "./TimelineNetworkDataSource";

export class MessageRepository {
  private static instance: MessageRepository = new MessageRepository();

  private readonly dbMessage: DbMessages;

  constructor() {
    this.dbMessage = DbMessages.getInstance();
  }

  public getConversationMessagePageDataSource(
    workspaceId: KristaId,
    inboxId: KristaId,
    pageSize: number = MessageConstants.ConversationDrainDefaultPageSize
  ): PageDataSource<KSDKExecution> {
    inboxId = KristaId.unwrapInboxId(inboxId);
    const cacheDataSource = this.dbMessage.createConversationDataSource(
      workspaceId,
      inboxId
    );
    let networkConversationsDataSource = new ConversationsNetworkDataSource(
      workspaceId,
      inboxId
    );
    const dataSource = new ConversationMergeDataSource(
      workspaceId,
      inboxId,
      cacheDataSource,
      networkConversationsDataSource
    );

    return new PageDataSource(dataSource, pageSize);
  }

  public getTimelinePageDataSource(
    workspaceId: KristaId,
    inboxId: KristaId,
    pageSize: number = MessageConstants.TimelineDrainDefaultPageSize
  ): PageDataSource<Message> {
    inboxId = KristaId.unwrapInboxId(inboxId);
    const cacheDataSource = this.dbMessage.createTimelineDataSource(
      workspaceId,
      inboxId
    );
    let networkDataSource = new TimelineNetworkDataSource(workspaceId, inboxId);
    const dataSource = new TimelineMergeDataSource(
      workspaceId,
      inboxId,
      cacheDataSource,
      networkDataSource
    );

    return new PageDataSource(dataSource, pageSize);
  }

  /**
   * A static method for getting a singleton instance of MessageRepository
   * @static
   * @returns {MessageRepository} A singleton instance of MessageRepository
   */
  public static getInstance(): MessageRepository {
    if (!this.instance) {
      this.instance = new MessageRepository();
    }
    return this.instance;
  }
}
