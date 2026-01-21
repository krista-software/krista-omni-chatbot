import { SocketRequest } from "./SocketRequest";

// TODO Delete this file
export interface ISocketSignalListener {
  onSignal(api: string, payload: any, requestContext?: SocketRequest): void;
}
