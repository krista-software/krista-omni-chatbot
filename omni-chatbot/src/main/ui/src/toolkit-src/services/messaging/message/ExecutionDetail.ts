import { KSDKMessage as Message } from "./KSDKMessage";
import { KristaId } from "../../../common/KristaId";
import { isUserVisibleMessages } from "./KristaMessageType";
import { SubmitType } from "./KSDKMessageSubmit";
import { Sidebar } from "./TimelineSidebarInbox";
import { MessageTable } from "../data-source-repository/MessageTable";
import { convertToNewStructure } from "../data-source-repository/TimelineNetworkDataSource";
import { consoleLog } from "../../../common/utils";

export class ExecutionDetail extends MessageTable<Message> {
  public readonly objectId = KristaId.generateUUID();
  // private readonly _displayMessages: Message[];
  // public readonly messageCount: number;
  public readonly conversationTitle: string;
  private mainMessages: Message[] = [];
  private sidebars: Sidebar[] = [];

  public requiredSync: boolean = false;

  constructor(
    public readonly executionId: KristaId,
    mainMessages: Message[],
    sidebars: Array<Message[]>
  ) {
    super(executionId.toString());
    this.conversationTitle = "";
    if (mainMessages) {
      for (let index = 0; index < mainMessages.length; index++) {
        if (mainMessages[index].executionMeta) {
          this.conversationTitle = mainMessages[index].executionTitle || "";
          break;
        }
      }
    }

    // this._displayMessages = ConversationDetail.prepareDisplayMessages(mainMessages, sidebars);
    // this.messageCount = this._displayMessages.length;
    const messages = this.prepareDisplayMessages(mainMessages, sidebars);
    this.clear();
    this.insertAtBottom(messages);
  }

  getId(): string {
    return this.executionId.id;
  }

  static msgCompare = (o1: Message, o2: Message) => {
    if (o1.getId() === o2.getId()) {
      return 0;
    }
    return o1.creationTime - o2.creationTime;
  };

  //region combine message and sidebar in single list
  private prepareDisplayMessages(
    mainMessages?: Message[],
    sidebars?: Array<Message[]>
  ): Message[] {
    if (!mainMessages) {
      return [];
    }
    const userDisplayMessages: Message[] = [];
    const unprocessedSidebars: Array<Message[]> = sidebars
      ? new Array<Message[]>(...sidebars)
      : [];
    let sidebarMsgCount = 0;
    let topSidebar: Message[] | undefined;

    //count sidebar form response count
    mainMessages.forEach((message) => {
      if (this.isSidebarInitiateMessage(message)) {
        sidebarMsgCount += 1;
      }
    });

    if (unprocessedSidebars.length > sidebarMsgCount) {
      topSidebar = unprocessedSidebars[0];
      unprocessedSidebars.splice(0, 1);
    }
    //end

    mainMessages.forEach((message, index) => {
      this.pushInternalPrepareUserVisibleMessage(message, userDisplayMessages);
      if (
        this.isSidebarInitiateMessage(message) &&
        unprocessedSidebars.length > 0
      ) {
        const sidebar = unprocessedSidebars[0];
        unprocessedSidebars.splice(0, 1);
        this.pushInternalPrepareUserVisibleMessage(
          sidebar,
          userDisplayMessages
        );
      }
    });

    if (topSidebar) {
      this.pushInternalPrepareUserVisibleMessage(
        topSidebar,
        userDisplayMessages,
        1
      );
    }

    return userDisplayMessages;
  }

  private isSidebarInitiateMessage(message: Message): boolean {
    if (!message.isIncoming) {
      if (message.submit && message.submit.type === SubmitType.sidebar) {
        // TODO KR-10713
        return true;
      }
    }
    return false;
  }

  updateMessage(messageUpdate: Message, splitMessage?: Message) {
    if (!messageUpdate) {
      return;
    }
    let targetList: Message[] = this.mainMessages;
    let index = -1;
    index = binarySearch<Message>(
      targetList,
      0,
      targetList.length - 1,
      messageUpdate,
      ExecutionDetail.msgCompare
    );
    if (index === -1) {
      for (let i = 0; i < this.sidebars.length; i++) {
        targetList = this.sidebars[i].getMessages();
        index = binarySearch<Message>(
          targetList,
          0,
          targetList.length - 1,
          messageUpdate,
          ExecutionDetail.msgCompare
        );
        if (index > -1) {
          break;
        }
      }
    }
    if (index > -1) {
      // update existing message.
      targetList[index].update(messageUpdate);
      if (splitMessage) {
        // insert or update split message.
        const splitMsgIndex = binarySearch<Message>(
          targetList,
          0,
          targetList.length - 1,
          splitMessage,
          ExecutionDetail.msgCompare
        );
        if (splitMsgIndex === -1) {
          targetList.splice(index + 1, 0, splitMessage);
        } else {
          this.updateMessage(splitMessage);
          return;
        }
      }
    }
    this.prepareDisplayMessages();
  }

  private pushInternalPrepareUserVisibleMessage(
    messages: Message | Message[],
    displayMessages: Message[],
    insertIndex?: number
  ): void {
    if (!messages) {
      return;
    }
    const makeSplitMessages: Message[] = Array.isArray(messages)
      ? messages
      : [messages];

    const _messages: Message[] = [];
    makeSplitMessages.forEach((msg) => {
      _messages.push(msg);
      const splitMessage = Message.createSplitMessage(msg);
      if (splitMessage) {
        _messages.push(splitMessage);
      }
    });

    _messages.forEach((msg) => {
      // don't show empty ask msg in case of only form as incoming msg
      if (isUserVisibleMessages(msg) && !msg.doHideMessageInChat) {
        if (!insertIndex) {
          displayMessages.push(msg);
        } else {
          displayMessages.splice(insertIndex++, 0, msg);
        }
      }
    });
  }

  //endregion

  public static fromJSON(json: any): ExecutionDetail | undefined {
    if (!json) {
      return undefined;
    }

    const executionId = KristaId.parse(json["executionId"]);
    const messages = json["messages"];
    const newMessages: any[] = messages["main"]
      .map((m: any) => convertToNewStructure(m)) // platform to ksdk conversion
      .filter((m: any) => !!m);
    consoleLog({ newMessages });
    const main = Message.fromJSONArray(newMessages);
    const sideBars: Array<Message[]> = [];
    const sideBarJson: Array<JSON[]> = messages["sidebars"];
    if (sideBarJson) {
      sideBarJson.forEach((sideBarJsonItem) => {
        sideBars.push(
          Message.fromJSONArray(
            sideBarJsonItem
              .map((m: any) => convertToNewStructure(m)) // platform to ksdk conversion
              .filter((m: any) => !!m)
          )
        );
      });
    }

    return new ExecutionDetail(executionId, main, sideBars);
  }
}

export function binarySearch<T>(
  array: T[],
  start: number,
  end: number,
  value: any,
  compare: (o1: T, o2: T) => number
): number {
  if (end >= start) {
    const mid = start + Math.ceil((end - start) / 2);
    if (compare(array[mid], value) === 0) {
      return mid;
    }
    if (compare(array[mid], value) > 0) {
      return binarySearch(array, start, mid - 1, value, compare);
    } else {
      return binarySearch(array, mid + 1, end, value, compare);
    }
  }
  return -1;
}
