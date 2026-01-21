import { MessageTypeTitle } from "./KristaMessageType";

export function isMediaMessageType(messageType: MessageTypeTitle) {
  return (
    messageType === MessageTypeTitle.MsgType_Audio ||
    messageType === MessageTypeTitle.MsgType_Image
  );
}

export enum MessageReceiptState {
  Pending = "pending", // Client state. When new message is created
  Ready = "ready", // Client state. When message is ready to be sent to the server
  Accepted = "accepted", // Server state. When message is accepted by server
  Received = "received", // Server state. When message is received at other end
  ReceivedAck = "receivedack",
  Read = "read", // Server state. When message is read at other end
  ReadAck = "readack", // Server state. When message is read at other end
  Dropped = "dropped",
}

export function initialReceiptStateForMessageType(
  messageType: MessageTypeTitle
): MessageReceiptState {
  if (isMediaMessageType(messageType)) {
    return MessageReceiptState.Pending;
  } else {
    return MessageReceiptState.Ready;
  }
}
