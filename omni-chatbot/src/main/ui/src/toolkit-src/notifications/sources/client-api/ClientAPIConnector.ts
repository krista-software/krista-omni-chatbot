import { ClientAPIClient } from "../../../client-api/ClientAPIClient";
import {
  SignalHandler,
  INotificationSignal,
  OutboundNotificationType,
  InboundNotificationType,
} from "../../../types";

export class ClientAPIConnector {
  private static instance: ClientAPIConnector;
  private readonly clientAPIClient = ClientAPIClient.getInstance();
  private readonly listeners: Map<InboundNotificationType, SignalHandler[]> =
    new Map();

  private constructor() {}

  /**
   * A static method for getting a singleton instance of ClientAPIConnector
   * @static
   * @returns {ClientAPIConnector} A singleton instance of ClientAPIConnector
   */
  static getInstance(): ClientAPIConnector {
    if (!this.instance) {
      this.instance = new ClientAPIConnector();
    }
    return this.instance;
  }

  init() {
    this.clientAPIClient.receiveNotification(this);
  }

  receiveNotification(type: InboundNotificationType, listener: SignalHandler) {
    const notificationListeners = this.listeners.get(type) || [];
    notificationListeners.push(listener);
    this.listeners.set(type, notificationListeners);
  }

  sendNotification(
    notification: INotificationSignal<OutboundNotificationType>
  ) {
    this.clientAPIClient.sendNotification(notification);
  }

  onNotificationSignal(signal: INotificationSignal<InboundNotificationType>) {
    const notificationType: InboundNotificationType = signal.payload.type;
    const notificationListeners = this.listeners.get(notificationType);
    if (notificationListeners) {
      notificationListeners.forEach((listener) => {
        listener.onNotificationSignal(signal);
      });
    }
  }
}
