import { KristaId } from "../../../common/KristaId";
import { KSDKMessage as Message } from "./KSDKMessage";
import { compareNumber } from "../../../common/utils";

export class TimelineSidebarInbox {
  private readonly executionSidebarMap = new Map<
    string,
    ConversationSidebars
  >();

  constructor(readonly inboxId: KristaId) {}

  public getSidebar(executionId: string): ConversationSidebars {
    return this.ensureConversationSidebar(executionId);
  }

  public insertSidebarMessage(messages: Message[]): {
    messages: Message[];
    sidebarMessages: Message[];
  } {
    const msgWithoutSidebars: Message[] = [];
    const sidebarMessages: Message[] = [];
    for (let index = 0; index < messages.length; index++) {
      const msg = messages[index];
      const stepExecutionMeta = msg.executionMeta;
      if (stepExecutionMeta) {
        const conversationSidebar = this.ensureConversationSidebar(
          stepExecutionMeta.executionId
        );
        const isSidebarMsg = conversationSidebar.insertSidebarMessage(msg);
        if (isSidebarMsg) {
          sidebarMessages.push(msg);
          continue;
        }
      }
      msgWithoutSidebars.push(msg);
    }
    return { messages: msgWithoutSidebars, sidebarMessages: sidebarMessages };
  }

  public ensureConversationSidebar(executionId: string): ConversationSidebars {
    let conversationSidebar = this.executionSidebarMap.get(
      executionId.toString()
    );
    if (!conversationSidebar) {
      conversationSidebar = new ConversationSidebars(executionId);
      this.executionSidebarMap.set(executionId.toString(), conversationSidebar);
    }
    return conversationSidebar;
  }
}

export class ConversationSidebars {
  public readonly objectId = KristaId.generateUUID();
  private readonly threadSidebarMap = new Map<string, Sidebar>();
  public title: string = "";

  constructor(readonly executionId: string) {}

  get hasSidebars(): boolean {
    return this.threadSidebarMap.size > 0;
  }

  getSidebar(): Sidebar[] {
    return Array.from<Sidebar>(this.threadSidebarMap.values());
  }

  insertSidebarMessage(message: Message): boolean {
    const stepExecutionMeta = message.executionMeta;
    if (stepExecutionMeta) {
      this.title = stepExecutionMeta.title;
      // TODO new-ksdk using flowId
      // const sidebarThreads = stepExecutionMeta.threads.filter((thread: string) =>
      //   thread.startsWith("sidebar-")
      // );
      // const branches = stepExecutionMeta.branch.filter((branch: string) => branch !== "main");
      const sidebarThreads: string[] = [];
      const branches: string[] = [];
      if (sidebarThreads.length > 0) {
        const topThread = sidebarThreads.shift() || "";
        const branchName = branches.shift() || "";
        const rootSidebar = this.ensureRootSidebar(branchName, topThread);
        rootSidebar.putMessage(message, branches, sidebarThreads);
        return true;
      }
    }
    return false;
  }

  private ensureRootSidebar(branch: string, rootThread: string): Sidebar {
    let conversationSidebar = this.threadSidebarMap.get(rootThread);
    if (!conversationSidebar) {
      conversationSidebar = new Sidebar(this.executionId, branch, rootThread);
      this.threadSidebarMap.set(rootThread, conversationSidebar);
    }
    return conversationSidebar;
  }
}

export class Sidebar {
  readonly executionId: string;
  readonly thread: string;
  public readonly title: string;
  private readonly messages: Message[] = [];
  private _lastUpdateTime: number = 0;
  private readonly subSidebar: Map<string, Sidebar> = new Map<
    string,
    Sidebar
  >();

  constructor(executionId: string, branch: string, thread: string) {
    this.executionId = executionId;
    this.title = branch;
    this.thread = thread;
  }

  private ensureChildSidebar(branch: string, thread: string): Sidebar {
    let sidebar = this.subSidebar.get(thread);
    if (!sidebar) {
      sidebar = new Sidebar(this.executionId, branch, thread);
      this.subSidebar.set(thread, sidebar);
    }
    return sidebar;
  }

  getMessages(): Message[] {
    return this.messages;
  }

  getLastUpdateTime(): number {
    return this._lastUpdateTime;
  }

  getChildSidebar(): Sidebar[] {
    return Array.from<Sidebar>(this.subSidebar.values());
  }

  putMessage(message: Message, branches: string[], threadStack: string[]) {
    this._lastUpdateTime = Math.max(this._lastUpdateTime, message.creationTime);
    if (threadStack.length === 0) {
      const findMessage = Sidebar.findMessage(message.messageId, this.messages);
      if (findMessage) {
        findMessage.update(message);
      } else {
        this.messages.push(message);
        this.messages.sort((a, b) => {
          return compareNumber(a.creationTime, b.creationTime);
        });
      }
    } else {
      const thread = threadStack.shift() || "";
      const branch = branches.shift() || "";
      const childSidebar = this.ensureChildSidebar(branch, thread);
      childSidebar.putMessage(message, branches, threadStack);
    }
  }

  equals(sidebar?: Sidebar): boolean {
    if (!sidebar) {
      return false;
    }
    return (
      this.executionId === sidebar.executionId && this.thread === sidebar.thread
    );
  }

  private static findMessage(
    messageId: string,
    messages: Message[]
  ): Message | undefined {
    for (const msg of messages) {
      if (msg.messageId === messageId) {
        return msg;
      }
    }
    return undefined;
  }
}
