import { ClientAPIConnector } from "../../notifications/sources/client-api/ClientAPIConnector";
import {
  SignalHandler,
  INotificationSignal,
  OutboundNotificationType,
  InboundNotificationType,
} from "../../types";

/**
 * Class for handling notifications.
 */
export class NotificationService {
  /**
   * Singleton instance of the class.
   */
  private static instance: NotificationService;

  /**
   * Source for receiving and sending notifications.
   */
  private readonly source = ClientAPIConnector.getInstance();

  /**
   * Private constructor to ensure singleton pattern.
   */
  private constructor() {}

  /**
   * Returns the singleton instance of the class.
   *
   * @returns {NotificationService} The singleton instance of the class.
   */
  static getInstance(): NotificationService {
    if (!this.instance) {
      this.instance = new NotificationService();
    }
    return this.instance;
  }

  init(): void {
    this.source.init();
  }

  /**
   * Registers a listener for a specific type of inbound notification.
   *
   * @param {InboundNotificationType} type - The type of inbound notification to listen for.
   * @param {SignalHandler} listener - The function to be called when the notification is received.
   */
  receiveNotification(type: InboundNotificationType, listener: SignalHandler) {
    this.source.receiveNotification(type, listener);
  }

  /**
   * Sends an outbound notification.
   *
   * @param {INotificationSignal<OutboundNotificationType>} notification - The outbound notification to send.
   */
  sendNotification(
    notification: INotificationSignal<OutboundNotificationType>
  ) {
    this.source.sendNotification(notification);
  }

  fireDummyNotification(signal: INotificationSignal<InboundNotificationType>)
  {
    this.source.onNotificationSignal(signal);
  }
}
