import { consoleLog } from "../../../common/utils";
import { KSDKIMessage as IMessage } from "../message/KSDKIMessage";

export class MessageTable<T extends IMessage> {
  private messages: T[] = [];
  private messageMap = new Map<string, T>();
  private writeInProgress = false;

  constructor(readonly inboxId: string) {}

  getMessage(messageId: string): T | undefined {
    return this.messageMap.get(messageId);
  }

  hasMessage(messageId: string): boolean {
    return this.messageMap.has(messageId);
  }

  getMessageAt(messageIndex: number): T | null {
    if (messageIndex < 0 || messageIndex >= this.messages.length) {
      return null;
    }
    return this.messages[messageIndex];
  }

  update(message: T): boolean {
    const existingMessage = this.messageMap.get(message.getId());
    if (existingMessage) {
      return existingMessage.update(message);
    }
    return false;
  }

  indexOf(messageId: string | null): number {
    return this.messages.findIndex((message) => message.getId() === messageId);
  }

  getMessages(startIndex: number, endIndex: number): T[] {
    if (this.messages.length === 0) {
      return [];
    }
    if (startIndex < 0) {
      startIndex = 0;
    }
    if (this.messages.length < endIndex) {
      endIndex = this.messages.length;
    }
    if (endIndex < startIndex) {
      endIndex = 0;
    }
    return this.messages.slice(startIndex, endIndex);
  }

  getAllMessages(): T[] {
    return this.messages;
  }

  get count(): number {
    return this.messages.length;
  }

  get lastMessage(): T | undefined {
    if (this.messages.length === 0) {
      return undefined;
    }
    return this.messages[this.count - 1];
  }

  get firstMessage(): T | undefined {
    if (this.messages.length === 0) {
      return undefined;
    }
    return this.messages[0];
  }

  insertAtBottom(messages: T[]) {
    const insert: T[] = [];
    const update: T[] = [];
    try {
      messages.forEach((msg) => {
        if (this.hasMessage(msg.getId())) {
          this.update(msg);
          update.push(msg);
        } else {
          this.messageMap.set(msg.getId(), msg);
          this.messages.push(msg);
          insert.push(msg);
        }
      });
      return { insert, update };
    } catch (e) {
      consoleLog("InboxMessageTable", "insertAtBottom", messages);
      throw e;
    }
  }

  insertAtTop(messages: T[]) {
    const insert: T[] = [];
    const update: T[] = [];
    try {
      for (let index = messages.length - 1; index >= 0; index--) {
        const msg = messages[index];
        if (this.hasMessage(msg.getId())) {
          this.update(msg);
          update.unshift(msg);
        } else {
          this.messageMap.set(msg.getId(), msg);
          this.messages.unshift(msg);
          insert.unshift(msg);
        }
      }
      return { insert, update };
    } catch (e) {
      consoleLog("InboxMessageTable", "insertAtBottom", messages);
      throw e;
    }
  }

  clear() {
    this.messages = [];
    this.messageMap.clear();
    this.writeInProgress = false;
  }
}
