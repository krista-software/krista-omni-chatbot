import { CacheMessageDataSource } from "./CacheMessageDataSource";
import {
  IMessageDataSource,
  InboxCallbackResult,
  ResultEvent,
} from "./IMessageDataSource";
import { KristaId } from "../../../common/KristaId";
import {
  consoleLog,
  firstElement,
  lastElement,
  newGuid,
} from "../../../common/utils";
import { KSDKMessage as Message } from "../message/KSDKMessage";
import { TimelineNetworkDataSource } from "./TimelineNetworkDataSource";

export class TimelineMergeDataSource implements IMessageDataSource<Message> {
  public readonly objectId = newGuid();

  constructor(
    readonly workspaceId: KristaId,
    readonly inboxId: KristaId,
    private readonly cacheDataSource: CacheMessageDataSource<Message>,
    private readonly networkDataSource: TimelineNetworkDataSource
  ) {}

  getMessages(
    offsetMessageId: string | undefined,
    before: number,
    after: number,
    callback: InboxCallbackResult<Message>
  ) {
    consoleLog("messaging: TimelineMergeDataSource: getMessages:", {
      offsetMessageId,
      before,
      after,
    });
    const networkSource = this.networkDataSource;
    const cacheCallbackResult: InboxCallbackResult<Message> = (
      event,
      cacheResult
    ) => {
      consoleLog("messaging: callback 3: cacheCallbackResult: ", {
        event,
        cacheResult,
      });
      consoleLog(
        "messaging: TimelineMergeDataSource: getMessages: cacheCallbackResult:",
        {
          event,
          cacheResult,
        }
      );
      if (event === ResultEvent.Success) {
        callback(event, cacheResult);
      } else {
        let cacheMessages = cacheResult.messages;
        if (cacheMessages.length === 0) {
          consoleLog(
            "messaging: TimelineMergeDataSource: getMessages: cacheCallbackResult: no messages in cache: ",
            {
              offsetMessageId,
              before,
              after,
            }
          );
          networkSource.getMessages(offsetMessageId, before, after, callback);
        } else if (event === ResultEvent.Reach_Bottom) {
          //prev page
          const _callback: InboxCallbackResult<Message> = (
            event,
            networkResult
          ) => {
            consoleLog("messaging: callback 4: _callback: ", {
              event,
              networkResult,
            });
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
          const _callback: InboxCallbackResult<Message> = (
            event,
            networkResult
          ) => {
            consoleLog("messaging: callback 5: _callback: ", {
              event,
              networkResult,
            });
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
