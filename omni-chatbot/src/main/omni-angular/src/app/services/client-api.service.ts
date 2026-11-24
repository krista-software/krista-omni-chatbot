import { Injectable } from '@angular/core';
import {
  SignalHandler,
  INotificationSignal,
  OutboundNotificationType,
  InboundNotificationType,
} from '../models/websocket.model';
import { WebSocketHandlerService } from './websocket-handler.service';
import { ConfigService } from './config.service';
import { AppConfig } from '../config/app.config';

@Injectable({
  providedIn: 'root'
})
export class ClientApiService implements SignalHandler {
  private wsHandler: WebSocketHandlerService | null = null;
  private listeners = new Map<InboundNotificationType, SignalHandler[]>();

  constructor(
    private webSocketHandler: WebSocketHandlerService,
    private configService: ConfigService
  ) {}

  init(): void {
    this.wsHandler = this.webSocketHandler;

    // Register this service as a listener to the WebSocket handler
    this.wsHandler.addListener(this);

    this.openWebSocketConnection();
  }

  /**
   * Creates the web socket connection.
   *
   * <p>Previously this opened the socket inside a {@code setTimeout(..., 2000)}
   * to band-aid an intermittent backend auth race seen at first attempt. The
   * delay added ~2 s of dead time to every cold open. Opening immediately
   * trades that dead time against the possibility of the race reappearing in
   * slower-consistency environments; if you see {@code close 1008} on the
   * first WS open after a fresh login, the race is back and the proper fix
   * is read-after-write consistency at the storage / auth layer.
   */
  openWebSocketConnection(): void {
    const config = this.configService.getToolkitConfig();
    if (!this.wsHandler || !config) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.host;
    const webSocketPath = AppConfig.getChatbotRoutingPath();
    const baseUrl = `${protocol}://${host}${webSocketPath}`;

    this.wsHandler?.init(baseUrl);
  }

  receiveNotification(type: InboundNotificationType, listener: SignalHandler): void {
    const notificationListeners = this.listeners.get(type) || [];
    notificationListeners.push(listener);
    this.listeners.set(type, notificationListeners);

  }

  sendNotification(notification: INotificationSignal<OutboundNotificationType>): void {
    if (this.wsHandler) {
      this.wsHandler.sendNotification(notification);
    } else {
    }
  }

  onNotificationSignal(signal: INotificationSignal<InboundNotificationType>): void {
    const notificationType: InboundNotificationType = signal.payload.type;
    const listeners = this.listeners.get(notificationType) || [];

    listeners.forEach((listener) => {
      try {
        listener.onNotificationSignal(signal);
      } catch (error) {
        console.error('ClientAPI - Error calling listener:', error);
      }
    });
  }

  disconnect(): void {
    if (this.wsHandler) {
      this.wsHandler.disconnect();
    }
  }

  markSessionTimedOut(): void {
    if (this.wsHandler) {
      this.wsHandler.markSessionTimedOut();
    }
  }

  isConnected(): boolean {
    return this.wsHandler?.isWebSocketConnected() || false;
  }
}
