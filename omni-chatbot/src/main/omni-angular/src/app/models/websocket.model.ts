export enum CallbackEvent {
  webSocketConnected = "webSocketConnected",
  connectionEstablished = "ConnectionEstablished",
  webSocketDisconnected = "webSocketDisconnected",
}

export interface ConfigOptions {
  readonly workspaceId: string;
  readonly nodeName: string;
  readonly clientSessionId: string;
  readonly webSocketHost: string;
  readonly user: {
    id: string;
    name: string;
  };
  readonly callback?: (event: CallbackEvent, payload?: any) => void;
}

export enum Signal {
  notification = "notification",
  authenticated = "authenticated",
  authenticate = "authenticate",
  ping = "ping",
  pong = "pong",
}

export enum OutboundNotificationType {
  Message = "Message",
  MessageAnswer = "MessageAnswer",
  Welcome = "welcome",
}

export enum InboundNotificationType {
  NewMessages = "NewMessages",
  UpdateMessage = "UpdateMessage",
  ExecutionStateUpdateNotification = "ExecutionStateUpdateNotification",
}

export type NotificationType = OutboundNotificationType | InboundNotificationType;

export interface SignalPayload {
  [key: string]: any;
}

export interface NotificationPayload<T extends NotificationType> extends SignalPayload {
  type: T;
  timestamp: number;
  payload: SignalPayload;
}

export interface ISignal<T extends SignalPayload> {
  signal: Signal;
  payload: T;
}

export interface INotificationSignal<T extends NotificationType> {
  signal: Signal.notification;
  payload: NotificationPayload<T>;
}

export interface SignalHandler {
  onNotificationSignal(signal: INotificationSignal<InboundNotificationType>): void;
}

export interface ISocketConnectionStateListener {
  onError?(event?: any): void;
  onConnect?(event?: any): void;
  onMessage?(data: any): void;
  onDisconnect?(event?: any): void;
}

export interface ITransformer {
  transform(data: string): ISignal<SignalPayload>;
}

export interface KSDKAccount {
  accountId: string;
  name: string;
}

export enum MessageType {
  Ask = "MessageAsk",
  Inform = "MessageInform",
  Answered = "MessageAnswered",
  ResponseAck = "MessageResponseAck",
}
