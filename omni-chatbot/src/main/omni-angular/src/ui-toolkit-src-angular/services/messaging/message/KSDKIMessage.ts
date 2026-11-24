/**
 * KSDKIMessage - Base message interface/abstract class
 * Mirrors original toolkit-src/services/messaging/message/KSDKIMessage.ts
 */

export abstract class KSDKIMessage {
  protected _uniqueKey: string = "";

  protected constructor(id: string) {
    this._uniqueKey = id + "_" + new Date().getTime();
  }

  abstract getId(): string;

  abstract getCreationTime(): number;

  abstract update(newMessage: KSDKIMessage): boolean;

  abstract get isRead(): boolean;

  abstract get isIncoming(): boolean;

  get isSplit(): boolean {
    return false;
  }

  protected updateUniqueKey() {
    this._uniqueKey = this.getId() + "_" + new Date().getTime();
  }

  public get uniqueKey() {
    return this._uniqueKey;
  }
}

