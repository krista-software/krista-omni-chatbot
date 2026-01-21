export enum CallbackEvent {
  webSocketConnected = "webSocketConnected",
  connectionEstablished ="ConnectionEstablished",
  webSocketDisconnected = "webSocketDisconnected",
  // TODO add other events
}

export type ConfigOptions = {
  readonly workspaceId: string;
  readonly nodeName: string;
  readonly clientSessionId: string;
  readonly webSocketHost: string;

  readonly user: {
    id: string;
    name: string;
  };
  readonly callback?: (event: CallbackEvent, payload?: any) => void;
};

export enum Signal {
  notification = "notification",
  authenticated = "authenticated",
  authenticate = "authenticate",
  ping = "ping",
  pong = "pong",
}

export enum OutboundNotificationType {
  // messageReceipt = "messageReceipt",
  Message = "Message",
  MessageAnswer = "MessageAnswer",
  Welcome = "welcome",
}

export enum InboundNotificationType {
  // TODO add all notifications
  NewMessages = "NewMessages",
  UpdateMessage = "UpdateMessage",
  ExecutionStateUpdateNotification = "ExecutionStateUpdateNotification",
  // badgeUpdate = "badgeUpdate",
  // closeConnection = "closeConnection",
  // messageUpdate = "messageUpdate",
  // workspaceChanged = "workspaceChanged",
  // widgetUpdate = "widgetUpdate",
}

export type NotificationType =
  | OutboundNotificationType
  | InboundNotificationType;

export interface SignalPayload {
  [key: string]: any;
}

export interface NotificationPayload<T extends NotificationType>
  extends SignalPayload {
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
  onNotificationSignal(
    signal: INotificationSignal<InboundNotificationType>
  ): void;
}
