import { Injectable } from '@angular/core';
import { 
  SignalHandler, 
  INotificationSignal, 
  OutboundNotificationType, 
  InboundNotificationType 
} from '../models/websocket.model';
import { ClientApiService } from './client-api.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private source: ClientApiService;

  constructor(private clientApiService: ClientApiService) {
    this.source = this.clientApiService;
  }

  init(): void {
    this.source.init();
  }

  /**
   * Registers a listener for a specific type of inbound notification.
   */
  receiveNotification(type: InboundNotificationType, listener: SignalHandler): void {
    this.source.receiveNotification(type, listener);
  }

  /**
   * Sends an outbound notification.
   */
  sendNotification(notification: INotificationSignal<OutboundNotificationType>): void {
    this.source.sendNotification(notification);
  }

  /**
   * Fire a dummy notification for testing
   */
  fireDummyNotification(signal: INotificationSignal<InboundNotificationType>): void {
    this.source.onNotificationSignal(signal);
  }
}
