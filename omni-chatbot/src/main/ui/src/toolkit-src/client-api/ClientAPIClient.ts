import { AxiosResponse } from "axios";
import {
  SignalHandler,
  INotificationSignal,
  OutboundNotificationType,
} from "../types";
import { RESTHandler } from "./protocols/rest/RestAPIHandler";
import { WebSocketHandler } from "./protocols/web-socket/WebSocketHandler";
import { ToolkitConfig } from "../ToolkitConfig";
import { GetExecutionsParams, GetMessagesParams } from "./protocols/rest/types";

export class ClientAPIClient {
  private static instance: ClientAPIClient;
  private wsHandler: WebSocketHandler | null = null;
  private restHandler: RESTHandler | null = null;

  private constructor() {}

  /**
   * A static method for getting a singleton instance of ClientAPIClient
   * @static
   * @returns {ClientAPIClient} A singleton instance of ClientAPIClient
   */
  public static getInstance(): ClientAPIClient {
    if (!ClientAPIClient.instance) {
      ClientAPIClient.instance = new ClientAPIClient();
    }
    return ClientAPIClient.instance;
  }

  /**
   * Starting point for client-api communication.
   */
  init(): void {
    this.wsHandler = WebSocketHandler.getInstance();
    this.restHandler = RESTHandler.getInstance();
    // this.wsHandler.setAuthHandler(this.authHandler);
  }

  /**
   * Creates the web socket connection.
   */
  openWebSocketConnection(): void {
    const config = ToolkitConfig.getInstance().getConfig();
    if (!this.wsHandler || !config) {
      console.error("Initiate ClientAPI using 'init' method first.");
      return;
    }
    this.wsHandler.init(
      `${window.location.protocol === "http:" ? "ws" : "wss"}://${
        window.location.host
      }${config.webSocketHost}`
    );
  }

  receiveNotification(callback: SignalHandler): void {
    if (this.wsHandler) {
      this.wsHandler.addListener(callback);
    } else {
      console.error("WebSocket connection not established.");
    }
  }

  sendNotification(
    notification: INotificationSignal<OutboundNotificationType>
  ): void {
    if (this.wsHandler) {
      this.wsHandler.sendNotification(notification);
    } else {
      console.error("WebSocket connection not established.");
    }
  }

  // private authHandler(): Promise<AxiosResponse<any>> {
  //   if (!this.restHandler) {
  //     throw new Error("CONFIG_NOT_SET");
  //   }
  //   return this.restHandler.authHandler();
  // }

  getMessages(params: GetMessagesParams): Promise<AxiosResponse<any>> {
    if (!this.restHandler) {
      throw new Error("CONFIG_NOT_SET");
    }
    // return Promise.resolve(getDummyResponse(params));
    return this.restHandler.getMessages(params);
  }

  getConversationExecutions(
    params: GetExecutionsParams
  ): Promise<AxiosResponse<any>> {
    if (!this.restHandler) {
      throw new Error("CONFIG_NOT_SET");
    }
    return this.restHandler.getConversationExecutions(params);
  }
}
