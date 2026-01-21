import {v4 as uuidv4} from "uuid";
import {WebSocketConnection} from "./WebSocketConnection";
import {TransformerFacade} from "./transformers/TransformerFacade";
import {
  CallbackEvent,
  InboundNotificationType,
  INotificationSignal,
  ISignal,
  OutboundNotificationType,
  Signal,
  SignalHandler,
  SignalPayload,
} from "../../../types";
import {ToolkitConfig} from "../../..";

// TODO should not expose wsHandler and restHandler while bundling
// TODO removeListeners method
export class WebSocketHandler {
  private readonly RECONNECT_OFFSET = 30;
  private readonly RELOAD_OFFSET = 120;
  private static instance: WebSocketHandler;
  private webSocket: WebSocketConnection | null = null;
  private listeners: SignalHandler[] = [];
  // private authHandler: (() => Promise<AxiosResponse<any>>) | null = null;
  private readonly transformer: TransformerFacade =
    TransformerFacade.getInstance();
  private isConnected = false;
  private connectionCheckInterval: number | undefined;
  private lastServerCommunicationTime = 0;
  private readonly allowedSignals = [
    Signal.notification,
    Signal.ping,
    Signal.authenticate,
  ];
  private lastPingReference: string = "";
  private shouldStopReconnecting = false;
  // Close codes that should stop reconnection attempts
  private readonly STOP_RECONNECT_CODES = [
    1008, // Policy Violation (used for authorization failures), User is not Authorised
  ];

  private constructor() {}

  /**
   * A static method for getting a singleton instance of WebSocketHandler
   * @static
   * @returns {WebSocketHandler} A singleton instance of WebSocketHandler
   */
  static getInstance(): WebSocketHandler {
    if (!this.instance) {
      this.instance = new WebSocketHandler();
    }
    return this.instance;
  }

  init(baseURL: string): void {
    if (!this.webSocket) {
      this.webSocket = WebSocketConnection.getInstance();
      const self = this;
      this.webSocket.connect(`${baseURL}ws`, {
        onConnect(event) {
          // TODO inform the event
        },
        onMessage(event) {
          let signalPayloadISignal = self.transformer.transform("text", event.data);
          // now send the welcome message only after the connection is established
          if(signalPayloadISignal
              && (signalPayloadISignal.signal == Signal.notification
                  && signalPayloadISignal.payload["type"] == CallbackEvent.connectionEstablished)) {

            console.log("Websocket connection established");
            self.isConnected = true;
            self.monitorConnection();
            self.sendPing();
            const config = ToolkitConfig.getInstance().getConfig();
            if (config && config.callback) {
              config.callback(CallbackEvent.webSocketConnected);
            }

          } else {
            self.updateServerCommunicationTime();
            self.signalHandler(signalPayloadISignal);
          }

        },
        onDisconnect(event) {
          self.isConnected = false;
          self.clearConnectionCheckInterval();

          // Check if we should stop reconnecting based on close code
          if (event && self.STOP_RECONNECT_CODES.includes(event.code)) {
            console.log(`Websocket disconnected with code ${event.code}: ${event.reason}. Stopping reconnection attempts.`);
            self.shouldStopReconnecting = true;
            self.webSocket?.close();
          } else {
            console.log("Websocket disconnected ", event);
          }
        },
        onError(event) {
          // TODO inform the event
          console.log("Websocket connection failed ", event);
        },
      });
    }
  }

  private monitorConnection(): void {
    if (this.connectionCheckInterval) {
      this.clearConnectionCheckInterval();
    }
    this.updateServerCommunicationTime();
    this.connectionCheckInterval = window.setInterval(() => {
      // Don't attempt reconnection if we've been told to stop
      if (this.shouldStopReconnecting) {
        this.clearConnectionCheckInterval();
        return;
      }

      const currentTime = Date.now();
      const difference =
        (currentTime - this.lastServerCommunicationTime) / 1000;
      if (this.isConnected) {
        if (difference > this.RECONNECT_OFFSET) {
          // TODO inform Client about reconnecting
          this.isConnected = false;
          this.webSocket?.reconnect();
        }
      } else if (difference > this.RELOAD_OFFSET) {
        // TODO inform Client
      }
    }, 10000);
  }

  private clearConnectionCheckInterval(): void {
    this.lastServerCommunicationTime = 0;
    clearInterval(this.connectionCheckInterval);
    this.connectionCheckInterval = undefined;
  }

  private updateServerCommunicationTime(): void {
    this.lastServerCommunicationTime = Date.now();
  }

  private signalHandler(signal: ISignal<SignalPayload>): void {
    if (!this.isConnected) {
      console.error("WebSocket connection closed.");
      return;
    }

    const notificationSignal =
      signal as INotificationSignal<InboundNotificationType>;
    switch (signal.signal) {
      case Signal.notification:
        this.listeners.forEach((listener) => {
          listener.onNotificationSignal(notificationSignal);
        });
        break;
      case Signal.pong:
        this.handlePong(signal.payload);
        break;
      // case Signal.authenticated:
      //   if (!signal.payload.authenticated) {
      //     this.authenticate();
      //   }
      //   break;
      default:
        console.error(`Unknown signal: ${signal.signal}.`);
        break;
    }
  }

  private handlePong(payload: SignalPayload) {
    // TODO validate last reference code?
    this.sendPing();
  }

  private sendPing(): void {
    setTimeout(() => {
      this.lastPingReference = uuidv4();
      this.sendSignal({
        signal: Signal.ping,
        payload: {
          timestamp: Date.now(),
          reference: this.lastPingReference,
        },
      });
    }, 10000);
  }

  // private authenticate(): void {
  //   // TODO where this should be handled?
  //   // need rest api here
  //   if (!this.authHandler) {
  //     throw new Error("Add Authentication handler!");
  //   }
  //   this.authHandler()
  //     .then((response) => {
  //       // TODO do we get response here if it redirect user to login screens?
  //       const data = response.data;
  //       this.sendSignal({
  //         signal: Signal.authenticate,
  //         payload: {
  //           authorizationCode: data.code,
  //         },
  //       });
  //     })
  //     .catch((error) => {
  //       consoleLog(error);
  //     });
  // }

  addListener(listener: SignalHandler): void {
    this.listeners.push(listener);
  }

  removeListener(listener: SignalHandler): void {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  sendNotification(
    notification: INotificationSignal<OutboundNotificationType>
  ): void {
    this.sendSignal(notification);
  }

  // setAuthHandler(handler: () => Promise<AxiosResponse<any>>): void {
  //   this.authHandler = handler;
  // }

  private sendSignal(signal: ISignal<SignalPayload>): void {
    if (!this.webSocket) {
      console.error("WebSocket connection not established.");
      return;
    }
    if (!this.isConnected) {
      console.error("WebSocket connection not established or closed.");
      return;
    }
    if (this.allowedSignals.includes(signal.signal)) {
      this.webSocket.sendMessage(signal);
    } else {
      console.error(`Unknown signal: ${signal.signal}.`);
    }
  }
}
