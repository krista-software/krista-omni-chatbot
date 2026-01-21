import { CloseEvent, ErrorEvent, Event } from "reconnecting-websocket";

export interface ISocketConnectionStateListener {
  onError?(event?: ErrorEvent): void;
  onConnect?(event?: Event): void;
  onMessage?(data: any): void;
  onDisconnect?(event?: CloseEvent): void;
}
