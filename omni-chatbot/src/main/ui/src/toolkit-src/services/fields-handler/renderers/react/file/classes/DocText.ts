import { DocBase } from "./DocBase";
import { MessageTypeTitle } from "../../../../../messaging/message/KristaMessageType";

export class DocText extends DocBase {
  text: string;

  constructor(text: string) {
    super(MessageTypeTitle.MsgType_Text);

    this.text = text;
  }

  toAttributes(): Map<string, any> {
    const attributes = new Map<string, any>();
    attributes.set("message", this.text);
    return attributes;
  }
}
