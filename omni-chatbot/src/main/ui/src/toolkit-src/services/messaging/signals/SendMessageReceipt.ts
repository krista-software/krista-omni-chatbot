import { KristaId } from "../../../common/KristaId";
import {
  KristaMessageType,
  MessageTypeTitle,
} from "../message/KristaMessageType";
import { MessageReceiptState } from "../message/MessageReceiptState";
import { SendMsgObject } from "./SendMsgObject";

export class SendMessageReceipt extends SendMsgObject {
  constructor(
    readonly msgId: KristaId,
    readonly state: MessageReceiptState = MessageReceiptState.Received
  ) {
    super(KristaMessageType.MsgType_Receipt, MessageTypeTitle.MsgType_Receipt);
  }

  getAttributes(): Map<string, any> {
    const attribute = new Map<string, any>();
    attribute.set("targetMessageId", this.msgId.id);
    attribute.set("state", this.state);
    return attribute;
  }
}
