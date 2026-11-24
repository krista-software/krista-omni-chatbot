import { Injectable } from '@angular/core';
import ReconnectingWebSocket from 'reconnecting-websocket';
import { ISignal, SignalPayload, ISocketConnectionStateListener } from '../models/websocket.model';
import { StorageService } from './storage.service';

/**
 * ReconnectingWebSocket reconnection retry cap. Exported as the single source of
 * truth because WebSocketHandlerService derives its terminal-disconnect threshold
 * from it (MAX_CONSECUTIVE_DISCONNECTS = WS_MAX_RETRIES + 1). Keeping both linked
 * via this one constant prevents drift that would break terminal-state detection.
 */
export const WS_MAX_RETRIES = 3;

@Injectable({
  providedIn: 'root'
})
export class WebSocketConnectionService {
  private webSocket: ReconnectingWebSocket | null = null;
  private isConnecting = false; // Prevent multiple connection attempts
  private connectionAttempts = 0; // Track connection attempts

  constructor(private storageService: StorageService) {

  }

  /**
   * Connect to a WebSocket server using ReconnectingWebSocket
   * @param {string} url - The URL of the WebSocket server
   * @param {ISocketConnectionStateListener} callbacks - An object containing callbacks for different connection states
   */
  connect(url: string, callbacks: ISocketConnectionStateListener): void {
    // Prevent multiple connection attempts
    if (this.webSocket || this.isConnecting) {
      return;
    }

    // Limit connection attempts to prevent infinite loops
    this.connectionAttempts++;
    if (this.connectionAttempts > 3) {
      return;
    }

    this.isConnecting = true;

    // Get session ID - try client session first, then auth data
    let sessionId = this.storageService.getClientSessionId();

    // If no client session, try to get from auth data
    if (!sessionId) {
      const authData = this.storageService.getLoggedInDetails();
      sessionId = authData?.clientSessionId ?? null;
    }

    // Generate device session ID if still no session (matches original app pattern)
    if (!sessionId) {
      sessionId = `device_${this.generateUUID()}`;
      this.storageService.setClientSessionId(sessionId);
    }

    // Build WebSocket URL. The param name MUST be clientSessionId — that is what
    // the backend's query fallback reads (ChatBotAuthenticator WS pre-check +
    // GuestRequestAuthenticator). This is the cookie-less auth path for the WS
    // upgrade: browsers cannot set custom headers on upgrades, and the session
    // cookie is third-party (blockable) when the chatbot is embedded.
    // The handler already appends ?lang=<code>, so join with '&' when a query
    // string exists — a second '?' would corrupt the lang value.
    const separator = url.includes('?') ? '&' : '?';
    const fullUrl = `${url}${separator}clientSessionId=${encodeURIComponent(sessionId)}`;

    this.webSocket = new ReconnectingWebSocket(
      fullUrl,
      [],
      {
        minReconnectionDelay: 2000,
        maxReconnectionDelay: 8000,
        connectionTimeout: 5000,
        reconnectionDelayGrowFactor: 1.5,
        maxRetries: WS_MAX_RETRIES, // Reduced to prevent infinite loops
        debug: false // Disable debug logging
      }
    );

    this.webSocket.onopen = (event) => {
      this.isConnecting = false;
      this.connectionAttempts = 0; // Reset attempts on successful connection
      if (callbacks.onConnect) {
        callbacks.onConnect(event);
      }
    };

    this.webSocket.onclose = (event) => {

      this.isConnecting = false;
      // Do NOT null this.webSocket here. ReconnectingWebSocket reuses the same
      // instance across reconnects; nulling it orphaned the live socket so a later
      // disconnect() (e.g. on a 1008 session timeout) became a no-op and could
      // never call rws.close() to stop the internal retry loop. Keeping the
      // reference lets disconnect() actually halt reconnection.
      if (callbacks.onDisconnect) {
        callbacks.onDisconnect(event);
      }
    };

    this.webSocket.onerror = (event) => {
      this.isConnecting = false;
      if (callbacks.onError) {
        callbacks.onError(event);
      }
    };

    this.webSocket.onmessage = (event) => {
      if (callbacks.onMessage) {
        callbacks.onMessage(event);
      }
    };
  }



  sendMessage(message: ISignal<SignalPayload>): void {
    if (this.webSocket) {
      const readyState = this.webSocket.readyState;

      if (readyState === WebSocket.OPEN) {
        this.webSocket.send(JSON.stringify(message));
      } else {
        // Try to send anyway if the WebSocket exists but isn't OPEN
        // ReconnectingWebSocket might handle queuing
        try {
          this.webSocket.send(JSON.stringify(message));
        } catch (error) {
          // Silent fail - WebSocket not ready
        }
      }
    }
  }

  disconnect(): void {
    if (this.webSocket) {
      this.webSocket.close();
      this.webSocket = null;
    }
  }

  isConnected(): boolean {
    const connected = this.webSocket?.readyState === WebSocket.OPEN;
    return connected;
  }

  reconnect(): void {
    if (this.webSocket) {
      this.webSocket.reconnect();
    }
  }

  /**
   * Reset connection attempts counter
   */
  resetConnectionAttempts(): void {
    this.connectionAttempts = 0;
    this.isConnecting = false;
  }

  /**
   * Check if WebSocket instance exists (regardless of connection state)
   */
  hasWebSocketInstance(): boolean {
    return !!this.webSocket;
  }

  /**
   * Generate UUID for device session ID (matches original app pattern)
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}
