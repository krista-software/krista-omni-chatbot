import { v4 as uuidv4 } from "uuid";
import { MediaType } from "../services/fields-handler/renderers/react/file/classes/MediaType";

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
  public static readonly ASK_USER_STEP = "CST_1040";
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

  //region id checks
  isTopicId(): boolean {
    return this.id.startsWith(IdType.PREFIX_TOPIC + KristaId.SEPARATOR);
  }

  isWorkspaceId(): boolean {
    return this.id.startsWith(IdType.PREFIX_WORKSPACE + KristaId.SEPARATOR);
  }

  isWsContactId(): boolean {
    return this.id.startsWith(IdType.PREFIX_WS_CONTACT + KristaId.SEPARATOR);
  }

  isExecutionId() {
    return KristaId.unwrapInboxId(this.id)
      .toString()
      .startsWith(IdType.PREFIX_EXECUTION_ID + KristaId.SEPARATOR);
  }

  isInboxId() {
    return this.id.startsWith(IdType.PREFIX_INBOX + KristaId.SEPARATOR);
  }

  isSessionId(): boolean {
    return KristaId.unwrapInboxId(this.id)
      .toString()
      .startsWith(IdType.PREFIX_SESSION + KristaId.SEPARATOR);
  }

  //endregion

  static isKristaContact(id: string) {
    return id.startsWith(IdType.PREFIX_KRISTA_CONTACT);
  }

  public static create(type: IdType): KristaId {
    return new KristaId(
      type.toString() + KristaId.SEPARATOR + this.generateUUID()
    );
  }

  public static createMediaId(type: IdType, ext?: string): KristaId {
    return new KristaId(
      type.toString() +
        KristaId.SEPARATOR +
        this.generateUUID() +
        (ext && ext.trim().length > 0 ? "." + ext : "")
    );
  }

  public static createDocId(mediaType: MediaType, ext?: string): KristaId {
    return new KristaId(
      IdType.PREFIX_DOC.toString() +
        KristaId.SEPARATOR +
        this.mangle(MediaType[mediaType]) +
        this.generateUUID() +
        (ext && ext.trim().length > 0 ? "." + ext : "")
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
      if (unwrapped.isTopicId()) {
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
    return this.parseInternal(str);
  }

  public static parseORUndefined(str: string): KristaId | undefined {
    if (!str) {
      return undefined;
    }
    return this.parseInternal(str);
  }

  public static parseInternal(str: string): KristaId {
    return new KristaId(str);
  }

  public static generateUUID(): string {
    return uuidv4();
  }

  static toStringArray(ids: Array<KristaId>): (string | null)[] | null {
    if (!ids) {
      return null;
    }

    return ids.map((kristaId) => (kristaId == null ? null : kristaId.id));
  }

  static hasSystemProcessing(mediaType: MediaType): boolean {
    return (
      mediaType === MediaType.icon ||
      mediaType === MediaType.image ||
      mediaType === MediaType.profile ||
      mediaType === MediaType.sticker ||
      mediaType === MediaType.video
    );
  }

  static mangle(magic: string): string {
    if (magic == null || (magic = magic.trim()).length === 0) {
      magic = "";
    }
    return magic + KristaId.SEPARATOR;
  }
}
