import { Injectable } from '@angular/core';
import { v4 as uuidv4 } from 'uuid';

export enum IdType {
  PREFIX_KRISTA_CONTACT = "single_krista",
  PREFIX_TOPIC = "defnMult",
  PREFIX_SESSION = "S",
  PREFIX_WORKSPACE = "ws",
  PREFIX_WS_CONTACT = "wsContact",
  PREFIX_INBOX = "inbox",
  PREFIX_EXECUTION_ID = "CEC",
  PREFIX_MESSAGE_TYPE_ID = "MT",
  PREFIX_MESSAGE_ID = "M",
  PREFIX_DEFN_FORM_CM = "defnForm",
  PREFIX_DEFN_FIELD = "defnField",
  PREFIX_REQUEST_ID = "REQ",
  PREFIX_DOC = "doc",
  PREFIX_IMAGE = "image",
  PREFIX_VIDEO = "video",
  PREFIX_ICON = "icon",
  PREFIX_PROFILE = "profile",
}

export class KristaId {
  private static readonly SEPARATOR = "_";

  readonly id: string;

  constructor(id: string) {
    this.id = id;
  }

  toString(): string {
    return this.id;
  }

  equals(other?: KristaId): boolean {
    return !other ? false : this.id === other.id;
  }

  isInboxId(): boolean {
    return this.id.startsWith(IdType.PREFIX_INBOX + KristaId.SEPARATOR);
  }

  isSessionId(): boolean {
    return KristaId.unwrapInboxId(this.id)
      .toString()
      .startsWith(IdType.PREFIX_SESSION + KristaId.SEPARATOR);
  }

  public static create(type: IdType): KristaId {
    return new KristaId(
      type.toString() + KristaId.SEPARATOR + this.generateUUID()
    );
  }

  public static createInboxId(id: KristaId | string): KristaId {
    const stringId = id instanceof KristaId ? id.id : id;
    return stringId.startsWith(IdType.PREFIX_INBOX)
      ? KristaId.parse(stringId)
      : KristaId.parse(IdType.PREFIX_INBOX + KristaId.SEPARATOR + stringId);
  }

  public static unwrapInboxId(id: KristaId | string): KristaId {
    const stringId = id instanceof KristaId ? id.id : id;
    return new KristaId(
      stringId.replace(IdType.PREFIX_INBOX + KristaId.SEPARATOR, "")
    );
  }

  public static unwrapSessionId(id: KristaId | string): KristaId | undefined {
    const stringId = id instanceof KristaId ? id.id : id;

    if (stringId) {
      const unwrapped = KristaId.unwrapInboxId(stringId);
      if (unwrapped.isSessionId()) {
        return unwrapped;
      }
      if (unwrapped.toString().startsWith(IdType.PREFIX_TOPIC + KristaId.SEPARATOR)) {
        return KristaId.parse(
          IdType.PREFIX_SESSION + KristaId.SEPARATOR + unwrapped.toString()
        );
      }
    }

    return undefined;
  }

  public static parse(str: string): KristaId {
    if (!str) {
      throw new Error("ID MUST BE NONE NULL IN PARSE.");
    }
    return new KristaId(str);
  }

  public static generateUUID(): string {
    return uuidv4();
  }
}

@Injectable({
  providedIn: 'root'
})
export class KristaIdService {

  constructor() { }

  /**
   * Create a new message ID in the format: M_<uuid>
   */
  createMessageId(): string {
    return KristaId.create(IdType.PREFIX_MESSAGE_ID).toString();
  }

  /**
   * Create an inbox ID from a session ID in the format: inbox_S_<uuid>
   */
  createInboxId(sessionId: string): string {
    return KristaId.createInboxId(sessionId).toString();
  }

  /**
   * Create a session ID in the format: S_<uuid>
   */
  createSessionId(): string {
    return KristaId.create(IdType.PREFIX_SESSION).toString();
  }

  /**
   * Create a workspace contact ID in the format: wsContact_<uuid>
   */
  createWorkspaceContactId(): string {
    return KristaId.create(IdType.PREFIX_WS_CONTACT).toString();
  }

  /**
   * Create a guest user name in the format: guest_<uuid>
   */
  createGuestUserName(): string {
    return `guest_${KristaId.generateUUID()}`;
  }

  /**
   * Generate a UUID
   */
  generateUUID(): string {
    return KristaId.generateUUID();
  }

  /**
   * Parse a string into a KristaId
   */
  parse(str: string): KristaId {
    return KristaId.parse(str);
  }
}
