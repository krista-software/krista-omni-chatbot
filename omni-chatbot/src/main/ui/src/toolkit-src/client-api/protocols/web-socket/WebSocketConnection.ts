import ReconnectingWebSocket from "reconnecting-websocket";
import { ISignal, SignalPayload } from "../../../types";
import { ISocketConnectionStateListener } from "./types";
import {PrefStorage} from "../../../../chatbot-src/modules/storage/PrefStorage.ts";

export class WebSocketConnection {
  private static instance: WebSocketConnection;
  private webSocket: ReconnectingWebSocket | null = null;

  private constructor() {}

  /**
   * A static method for getting a singleton instance of WebSocketConnection
   * @static
   * @returns {WebSocketConnection} A singleton instance of WebSocketConnection
   */
  static getInstance(): WebSocketConnection {
    if (!this.instance) {
      this.instance = new WebSocketConnection();
    }
    return this.instance;
  }

  /**
   * Connect to a WebSocket server using ReconnectingWebSocket
   * @param {string} url - The URL of the WebSocket server
   * @param {ISocketConnectionStateListener} callbacks - An object containing callbacks for different connection states: onConnect, onDisconnect, onError, onMessage
   */
  connect(url: string, callbacks: ISocketConnectionStateListener): void {
    if (this.webSocket) {
      return;
    }
    this.webSocket = new ReconnectingWebSocket(`${url}?chatbotSessionId=${PrefStorage.getClientSessionId()}`, [], {
      minReconnectionDelay: 1000,
      maxReconnectionDelay: 4000,
      connectionTimeout: 4000,
      reconnectionDelayGrowFactor: 1.25,
    });

    this.webSocket.onopen = (event) => {
      if (callbacks.onConnect) {
        callbacks.onConnect(event);
      }
    };

    this.webSocket.onclose = (event) => {
      if (callbacks.onDisconnect) {
        callbacks.onDisconnect(event);
      }
    };

    this.webSocket.onerror = (event) => {
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

  reconnect(): void {
    if (this.webSocket) {
      this.webSocket.reconnect();
    }
  }

  close(): void {
    if (this.webSocket) {
      this.webSocket.close();
      this.webSocket = null;
    }
  }

  sendMessage(message: ISignal<SignalPayload>): void {
    if (this.webSocket) {
      this.webSocket.send(JSON.stringify(message));
    } else {
      console.error("WebSocket connection not established.");
    }
  }
}
