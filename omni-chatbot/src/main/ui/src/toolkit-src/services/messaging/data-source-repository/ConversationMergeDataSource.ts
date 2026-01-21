import { CacheMessageDataSource } from "./CacheMessageDataSource";
import { ConversationsNetworkDataSource } from "./ConversationsNetworkDataSource";
import {
  IMessageDataSource,
  InboxCallbackResult,
  ResultEvent,
} from "./IMessageDataSource";
import { KristaId } from "../../../common/KristaId";
import { KSDKExecution as Execution } from "../message/KSDKExecution";
import { firstElement, lastElement, newGuid } from "../../../common/utils";

export class ConversationMergeDataSource
  implements IMessageDataSource<Execution>
{
  public readonly objectId = newGuid();

  constructor(
    readonly workspaceId: KristaId,
    readonly inboxId: KristaId,
    private readonly cacheDataSource: CacheMessageDataSource<Execution>,
    private readonly networkDataSource: ConversationsNetworkDataSource
  ) {}

  getMessages(
    offsetMessageId: string | undefined,
    before: number,
    after: number,
    callback: InboxCallbackResult<Execution>
  ) {
    const networkSource = this.networkDataSource;
    const cacheCallbackResult: InboxCallbackResult<Execution> = (
      event,
      cacheResult
    ) => {
      if (event === ResultEvent.Success) {
        callback(event, cacheResult);
      } else {
        let cacheMessages = cacheResult.messages;
        if (cacheMessages.length === 0) {
          networkSource.getMessages(offsetMessageId, before, after, callback);
        } else if (event === ResultEvent.Reach_Bottom) {
          //prev page
          const _callback: InboxCallbackResult<Execution> = (
            event,
            networkResult
          ) => {
            callback(event, {
              messages: [...cacheMessages, ...networkResult.messages],
              sidebars: networkResult.sidebars,
            });
          };
          networkSource.getMessages(
            lastElement(cacheMessages)?.getId(),
            before,
            after - cacheMessages.length,
            _callback
          );
        } else if (event === ResultEvent.Reach_Top) {
          //next page
          const _callback: InboxCallbackResult<Execution> = (
            event,
            networkResult
          ) => {
            callback(event, {
              messages: [...networkResult.messages, ...cacheMessages],
              sidebars: networkResult.sidebars,
            });
          };
          networkSource.getMessages(
            firstElement(cacheMessages)?.getId(),
            before - cacheMessages.length,
            after,
            _callback
          );
        }
      }
    };
    this.cacheDataSource.getMessages(
      offsetMessageId,
      before,
      after,
      cacheCallbackResult
    );
  }

  close() {
    this.cacheDataSource.close();
    this.networkDataSource.close();
  }
}
