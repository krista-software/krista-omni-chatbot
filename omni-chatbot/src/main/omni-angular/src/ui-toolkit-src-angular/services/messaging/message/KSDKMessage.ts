/**
 * KSDKMessage - Main message class
 * Mirrors original toolkit-src/services/messaging/message/KSDKMessage.ts
 *
 * KEY FEATURE: Automatically calculates isIncoming based on sender ID vs current user ID
 * This is done in the constructor, matching the original app pattern exactly.
 */

import { KristaId } from '../../../common/KristaId';
import { ToolkitConfig } from '../../../config/ToolkitConfig';
import { KSDKIMessage } from './KSDKIMessage';
import {
  MessageType,
  SubmitType,
  AuthMessage,
  SystemEventType,
  SystemEventData,
  KSDKAccount,
  KSDKExecutionMeta,
  KSDKMedia,
  KSDKMessageSubmit,
  KSDKTargetAudience,
  KSDKTimer,
  Responder,
  KSDKForm,
  FormField,
  FormPage
} from './types';

export class KSDKMessage extends KSDKIMessage {
  public readonly objectId = KristaId.generateUUID();
  private _isIncoming: boolean = false;
  public readonly isSystemEventMessage: boolean = false;
  public _isSplit: boolean = false;

  // Compatibility properties for Angular components
  public readonly id: string;
  public readonly message?: string;
  public readonly sender?: KSDKAccount;

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
    readonly systemEventData?: SystemEventData,
    readonly informStepType?: string,
    readonly statusMessages?: string[]
  ) {
    super(messageId);

    // Set compatibility properties
    this.id = messageId;
    this.message = userMessage;
    this.sender = senderAccount;

    // CRITICAL: Automatically calculate isIncoming based on sender ID comparison
    // This matches original app pattern exactly: this._isIncoming = this.senderAccount?.id !== config?.user.id;
    const config = ToolkitConfig.getInstance().getConfig();
    this._isIncoming = this.senderAccount?.id !== config?.user.id;

    // Set form readOnly based on message type
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

  // Setter required by MessageService.handleUpdateMessages, which refreshes the
  // form on an existing message in place. Without it, `message.form = ...` is a
  // strict-mode assignment to a getter-only accessor and throws a TypeError.
  set form(form: KSDKForm | undefined) {
    this._form = form;
  }

  override get isSplit(): boolean {
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
    return true; // TODO: Implement read status tracking
  }

  get isIncoming(): boolean {
    return this._isIncoming;
  }

  set isIncoming(value: boolean) {
    this._isIncoming = value;
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

  get hasValidForm(): boolean {
    return !!(this._form && this._form.pages && this._form.pages.length > 0);
  }

  /**
   * Create a clone of this message with a different sender and creation time.
   * Used by createSplitMessage() to produce the right-side read-only copy.
   */
  clone(fromAccount: KSDKAccount, creationTime: number): KSDKMessage {
    return new KSDKMessage(
      this.messageId + '_1',
      this._messageType,
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

  /**
   * Create a split message for the right side of the chat.
   * Mirrors original: KSDKMessage.createSplitMessage()
   *
   * Conditions:
   * - Message must be answered
   * - Sender must NOT be the current user (incoming bot message)
   * - Must have a valid form or paths (not sidebar-only)
   * - Form must be read-only
   */
  static createSplitMessage(msg: KSDKMessage): KSDKMessage | undefined {
    const config = ToolkitConfig.getInstance().getConfig();
    if (!msg || !msg.isAnswered || msg.senderAccount.id === config?.user.id) {
      return undefined;
    }
    const hasFormOrPath = msg.hasValidForm || msg.hasPath;
    const hasSidebar = msg.hasSidebar;
    const hasOnlySidebar = !hasFormOrPath && hasSidebar;
    const isReadOnly = !!msg._form?.readOnly;
    if (!isReadOnly || !hasFormOrPath || hasOnlySidebar) {
      return undefined;
    }
    const contactId = config?.user.id || '';
    const name = config?.user.name || '';
    const fromAccount: KSDKAccount = { id: contactId, name: name };
    const message: KSDKMessage = msg.clone(fromAccount, msg.creationTime + 1);
    message.isIncoming = false;
    message._isSplit = true;
    return message;
  }

  get isStatusInform(): boolean {
    return this.informStepType === 'status';
  }
}

// Re-export types for convenience
export { MessageType, SubmitType };
export type { AuthMessage, SystemEventType, SystemEventData, KSDKAccount, KSDKExecutionMeta, KSDKMedia, KSDKMessageSubmit, KSDKTargetAudience, KSDKTimer, Responder, KSDKForm, FormField, FormPage };

