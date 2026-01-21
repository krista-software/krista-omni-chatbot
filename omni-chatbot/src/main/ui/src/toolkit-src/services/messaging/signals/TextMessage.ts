import { IdType, KristaId } from "../../../common/KristaId";
import {
  KristaMessageType,
  MessageTypeTitle,
} from "../message/KristaMessageType";
import { SendMsgObject } from "./SendMsgObject";

export class TextMessage extends SendMsgObject {
  readonly id = KristaId.create(IdType.PREFIX_MESSAGE_ID);

  constructor(private message: string) {
    super(KristaMessageType.MsgType_Text, MessageTypeTitle.MsgType_Text);
  }

  getAttributes(): Map<string, any> {
    const attribute = new Map<string, any>();
    attribute.set("message", this.message);
    return attribute;
  }
}
