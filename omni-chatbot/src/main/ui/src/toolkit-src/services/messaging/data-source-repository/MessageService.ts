import { KristaId } from "../../../common/KristaId";
import { newGuid } from "../../../common/utils";
import { OutboundNotificationType, Signal } from "../../../types";
import { NotificationService } from "../../notification/NotificationService";
import { KSDKFormResponse } from "../form/KSDKFormResponse";
import { KSDKAccount } from "../message/KSDKAccount";
import { KSDKMessage as Message, MessageType } from "../message/KSDKMessage";
import { SyncMessageService } from "../signals/SyncMessageService";

export class MessageService {
  private static instance: MessageService = new MessageService();
  readonly objectId = newGuid();
  private readonly syncMessageService = SyncMessageService.getInstance();

  private constructor() {}

  //region message api
  public sendInboxTextMessage(
    inboxId: KristaId,
    account: KSDKAccount,
    message: string
  ) {
    const rtoMessage = Message.createRtoMessage(inboxId, {
      message,
      type: MessageType.Inform,
    });
    const textMessage = Message.createMessageFromRto(account, rtoMessage);
    this.syncMessageService.syncUserSentMessage(inboxId, [textMessage]);
    const messagePayload = Message.createChatbotRtoMessage(
      inboxId,
      textMessage,
      account
    );
    NotificationService.getInstance().sendNotification({
      signal: Signal.notification,
      payload: {
        type: OutboundNotificationType.Message,
        timestamp: Date.now(),
        payload: {
          inboxId: inboxId.toString(),
          message: messagePayload,
        },
      },
    });
  }

  public submitInboxMessage(
    inboxId: KristaId,
    messageId: KristaId,
    formResponse: KSDKFormResponse
  ) {
    NotificationService.getInstance().sendNotification({
      signal: Signal.notification,
      payload: {
        type: OutboundNotificationType.MessageAnswer,
        timestamp: Date.now(),
        payload: {
          inboxId: inboxId.toString(),
          message: {
            targetMessageId: messageId.id,
            creationTime: Date.now(),
            submitType: formResponse.submitType,
            submitValue: formResponse.submitValue,
            fieldValues: formResponse.toJSON()["values"] || null,
          },
        },
      },
    });
  }

  //endregion

  /**
   * A static method for getting a singleton instance of MessageService
   * @static
   * @returns {MessageService} A singleton instance of MessageService
   */
  public static getInstance(): MessageService {
    if (!this.instance) {
      this.instance = new MessageService();
    }
    return this.instance;
  }
}
