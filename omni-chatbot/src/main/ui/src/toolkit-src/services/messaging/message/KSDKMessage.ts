import { IdType, KristaId } from "../../../common/KristaId";
import { KSDKAccount } from "./KSDKAccount";
import { KSDKExecutionMeta } from "./KSDKExecutionMeta";
import { KSDKForm } from "../form/KSDKForm";
import { KSDKIMessage } from "./KSDKIMessage";
import { KSDKMedia } from "./KSDKMedia";
import { KSDKMessageSubmit } from "./KSDKMessageSubmit";
import { KSDKTargetAudience } from "./KSDKTargetAudience";
import { KSDKTimer } from "./KSDKTimer";
import { Responder } from "./Responder";
import { ToolkitConfig } from "../../../ToolkitConfig";

export enum MessageType {
  Ask = "MessageAsk",
  Inform = "MessageInform",
  Answered = "MessageAnswered",
  ResponseAck = "MessageResponseAck",
}

export type AuthMessage = {
  authUrl: string;
  systemName: string;
};

export type SystemEventType = "join-task" | "leave-task";

export type SystemEventData = {
  account: {
    name: string;
    _id: string;
  };
  activeParticipantCounts: number;
};

export class KSDKMessage extends KSDKIMessage {
  public readonly objectId = KristaId.generateUUID();
  private _isIncoming: boolean = false;
  public readonly isSystemEventMessage: boolean = false;
  private _isSplit: boolean = false;

  constructor(
    readonly messageId: string,
    private _messageType: MessageType,
    readonly inboxId: KristaId,
    readonly creationTime: number,
    readonly senderAccount: KSDKAccount,
    public userMessage: string = "",
    readonly media?: KSDKMedia[],
    private _form?: KSDKForm,
    readonly submit?: KSDKMessageSubmit,
    readonly executionMeta?: KSDKExecutionMeta,
    readonly paths?: string[],
    readonly sideConversations?: string[],
    readonly targetAudience?: KSDKTargetAudience,
    readonly timer?: KSDKTimer,
    readonly sessionId?: KristaId,
    readonly copies?: { [key: string]: string },
    readonly responder?: Responder,
    readonly authentication?: AuthMessage,
    readonly systemEventType?: SystemEventType,
    readonly systemEventData?: SystemEventData
  ) {
    super(messageId);
    const config = ToolkitConfig.getInstance().getConfig();
    // this.userMessage = getSanitizedMarkup((this.userMessage || "").replace(/\\"/g, "&quot;"));
    // TODO should we assign "start" message a new type instead of handling it as "ask a person" step?
    this._isIncoming = this.senderAccount?.id !== config?.user.id;
    if (this._form) {
      this._form.readOnly = this._messageType !== MessageType.Ask;
    }
    this.isSystemEventMessage = !!systemEventType;
  }

  get messageType(): MessageType {
    return this._messageType;
  }

  get form(): KSDKForm | undefined {
    return this._form;
  }

  get isSplit(): boolean {
    return this._isSplit;
  }

  getId(): string {
    return this.messageId;
  }

  getCreationTime(): number {
    return this.creationTime;
  }

  update(updatedMessage: KSDKMessage): boolean {
    if (!updatedMessage) {
      return false;
    }
    this.updateUniqueKey();
    this._messageType = updatedMessage.messageType;
    this._form = updatedMessage.form;
    return true;
  }

  get executionTitle(): string {
    return this.executionMeta?.title || "";
  }

  get executionId(): string {
    return this.executionMeta?.executionId || "";
  }

  get executionMode(): string {
    return this.executionMeta?.executionMode || "";
  }

  get isAnswered(): boolean {
    return this._messageType === MessageType.Answered;
  }

  get isRead(): boolean {
    return true; // TODO new-ksdk what to do with it?
  }

  get isIncoming(): boolean {
    return this._isIncoming;
  }

  get hasPath(): boolean {
    return !!(this.paths && this.paths.length > 0);
  }

  get hasSidebar(): boolean {
    return !!(this.sideConversations && this.sideConversations.length > 0);
  }

  get hasMessage(): boolean {
    return !!(this.userMessage && this.userMessage.trim() !== "");
  }

  get doHideMessageInChat(): boolean {
    return !!(
      this.isAnswered &&
      this.isIncoming &&
      !this.hasMessage &&
      this._form &&
      this._form.readOnly
    );
  }

  get hasValidForm() {
    return KSDKForm.isValidForm(this._form);
  }

  set isIncoming(isIncoming: boolean) {
    this._isIncoming = isIncoming;
  }

  get isFromKrista(): boolean {
    return (
      (this.senderAccount && KristaId.isKristaContact(this.senderAccount.id)) ||
      false
    );
  }

  clone(fromAccount: KSDKAccount, creationTime: number): KSDKMessage {
    return new KSDKMessage(
      this.messageId + "_1",
      this._messageType, // TODO new-ksdk change to a different message type?
      this.inboxId,
      creationTime,
      fromAccount,
      this.userMessage,
      this.media,
      this._form,
      this.submit,
      this.executionMeta,
      this.paths,
      this.sideConversations,
      undefined,
      this.timer,
      this.sessionId,
      this.copies,
      this.responder,
      this.authentication,
      this.systemEventType,
      this.systemEventData
    );
  }

  cloneWithMsgId(msgId?: KristaId): KSDKMessage {
    const id: KristaId = msgId
      ? msgId
      : KristaId.parse(this.messageId.toString() + "_1");
    return new KSDKMessage(
      id.toString(),
      this._messageType,
      this.inboxId,
      this.creationTime,
      this.senderAccount,
      this.userMessage,
      this.media,
      this._form,
      this.submit,
      this.executionMeta,
      this.paths,
      this.sideConversations,
      this.targetAudience,
      this.timer,
      this.sessionId,
      this.copies,
      this.responder,
      this.authentication,
      this.systemEventType,
      this.systemEventData
    );
  }

  static createSplitMessage(msg: KSDKMessage): KSDKMessage | undefined {
    const config = ToolkitConfig.getInstance().getConfig();
    if (!msg || !msg.isAnswered || msg.senderAccount.id == config?.user.id) {
      return undefined;
    }
    const hasFormOrPath = msg.hasValidForm || msg.hasPath;
    const hasSidebar = msg.hasSidebar;
    const hasOnlySidebar = !hasFormOrPath && hasSidebar;
    const isReadOnly = !!msg._form?.readOnly;
    if (!isReadOnly || !hasFormOrPath || hasOnlySidebar) {
      return undefined;
    }
    const contactId = config?.user.id || "";
    const name = config?.user.name || "";
    const fromAccount = new KSDKAccount(contactId, name);
    const message: KSDKMessage = msg.clone(fromAccount, msg.creationTime + 1);
    message.isIncoming = false;
    message._isSplit = true;
    return message;
  }

  static fromJSON(json: any): KSDKMessage | undefined {
    if (!json) {
      return undefined;
    }

    return new KSDKMessage(
      json["id"],
      json["type"],
      KristaId.parse(json["inboxId"]),
      json["creationTime"],
      KSDKAccount.fromJSON(json["sender"]),
      json["message"],
      KSDKMedia.fromJSONArray(json["media"]),
      KSDKForm.fromJSON(json["form"]),
      KSDKMessageSubmit.fromJSON(json["submit"]),
      KSDKExecutionMeta.fromJSON(json["executionMeta"]),
      json["paths"],
      json["sideConversations"],
      KSDKTargetAudience.fromJSON(json["targetAudience"]),
      KSDKTimer.fromJSON(json["timer"]),
      KristaId.parseORUndefined(json["sessionId"]),
      json["copies"],
      Responder.fromJSON(json["responder"]),
      json["authenticationMeta"],
      json["eventType"],
      json["eventPayload"]
    );
  }

  static fromJSONArray(jsonArray: any[]): KSDKMessage[] {
    if (!jsonArray) {
      return [];
    }

    const messages = new Array<KSDKMessage>();
    jsonArray.forEach((messageJson) => {
      const message = this.fromJSON(messageJson);
      if (message) {
        messages.push(message);
      }
    });
    return messages;
  }

  static createMessageFromRto(fromAccount: KSDKAccount, rtoMessage: any) {
    return new KSDKMessage(
      rtoMessage["id"],
      rtoMessage["type"],
      KristaId.parse(rtoMessage["inboxId"]),
      Date.now(),
      fromAccount,
      rtoMessage["message"]
    );
  }

  static createChatbotRtoMessage(
    inboxId: KristaId,
    message: KSDKMessage,
    sender: KSDKAccount
  ) {
    const rtoJson: any = {};
    if (message) {
      rtoJson["executionMeta"] = message.executionMeta?.toJSON();
      const sessionId = KristaId.unwrapSessionId(message.inboxId);
      rtoJson["sessionId"] = sessionId ? sessionId.toString() : undefined;
      rtoJson["id"] = message.messageId;
    } else {
      const sessionId = KristaId.unwrapSessionId(inboxId);
      rtoJson["sessionId"] = sessionId ? sessionId.toString() : undefined;
      rtoJson["id"] = KristaId.create(IdType.PREFIX_MESSAGE_ID).toString();
    }
    rtoJson["inboxId"] = KristaId.createInboxId(inboxId).toString();
    rtoJson["type"] = MessageType.Inform;
    rtoJson["sender"] = sender.toJSON();
    rtoJson["message"] = message.userMessage;
    return rtoJson;
  }

  static createRtoMessage(
    inboxId: KristaId,
    msgObject: { [key: string]: any },
    message?: KSDKMessage
  ) {
    const rtoJson: any = {
      ...msgObject,
    };
    if (message) {
      rtoJson["executionMeta"] = message.executionMeta?.toJSON();
      const sessionId = KristaId.unwrapSessionId(message.inboxId);
      rtoJson["sessionId"] = sessionId ? sessionId.toString() : undefined;
    } else {
      const sessionId = KristaId.unwrapSessionId(inboxId);
      rtoJson["sessionId"] = sessionId ? sessionId.toString() : undefined;
    }
    rtoJson["id"] = KristaId.create(IdType.PREFIX_MESSAGE_ID).toString();
    rtoJson["inboxId"] = KristaId.createInboxId(inboxId).toString();
    return rtoJson;
  }
}
