import { KSDKIMessage as IMessage } from "../message/KSDKIMessage";
import {
  IMessageDataSource,
  InboxCallbackResult,
  ResultEvent,
} from "./IMessageDataSource";
import { KristaId } from "../../../common/KristaId";
import { MessageTable } from "./MessageTable";
import { consoleLog, newGuid } from "../../../common/utils";

export class CacheMessageDataSource<T extends IMessage>
  implements IMessageDataSource<T>
{
  public readonly objectId = newGuid();
  private readonly inboxMessageTable: MessageTable<T>;

  constructor(
    readonly workspaceId: KristaId,
    readonly inboxId: KristaId,
    messageTable: MessageTable<T>
  ) {
    this.inboxMessageTable = messageTable;
  }

  getMessages(
    offsetMessageId: string | undefined,
    before: number,
    after: number,
    callback: InboxCallbackResult<T>
  ) {
    consoleLog("messaging: CacheMessageDataSource: getMessages: ", {
      offsetMessageId,
      before,
      after,
    });
    let messageCount = this.inboxMessageTable.count;
    consoleLog(
      "messaging: CacheMessageDataSource: getMessages: messageCount: ",
      messageCount
    );
    if (messageCount === 0) {
      callback(ResultEvent.No_Data, { messages: [] });
      return;
    }
    let startIndex: number;
    let endIndex: number;
    let resultEvent = ResultEvent.Success;
    if (!offsetMessageId || offsetMessageId === "") {
      // TODO when is this scenario?
      if (after > 0 && before > 0) {
        startIndex = messageCount - (before + after);
        endIndex = messageCount;
      } else if (after > 0 && before === 0) {
        // this scenario only occur which fetching nextPage with empty offset and nextPage
        //already visited channel and has data in cache;
        startIndex = messageCount - after;
        endIndex = messageCount;
      } else {
        startIndex = messageCount - before;
        endIndex = messageCount;
      }
      if (startIndex < 0) {
        resultEvent = ResultEvent.Reach_Bottom;
      }
    } else {
      const index = this.indexOf(offsetMessageId);
      if (before === 0 && after > 0) {
        startIndex = index + 1;
        endIndex = startIndex + after;
        if (startIndex >= messageCount || endIndex > messageCount) {
          resultEvent = ResultEvent.Reach_Bottom;
        }
      } else if (after === 0 && before > 0) {
        startIndex = index - before;
        endIndex = index;
        if (startIndex < 0 || endIndex < 0) {
          resultEvent = ResultEvent.Reach_Top;
        }
      } else {
        startIndex = index - before;
        endIndex = index + after;
      }
    }
    const messages = this.inboxMessageTable.getMessages(startIndex, endIndex);
    callback(resultEvent, { messages: messages });
  }

  close() {}

  messageAt(index: number): T | null {
    return this.inboxMessageTable.getMessageAt(index);
  }

  indexOf(messageId: string | null): number {
    return this.inboxMessageTable.indexOf(messageId);
  }
}
