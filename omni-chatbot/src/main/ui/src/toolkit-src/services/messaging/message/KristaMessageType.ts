import { KSDKMessage as Message } from "./KSDKMessage";

export enum KristaMessageType {
  MsgType_Text = "MT_1010",
  MsgType_Form = "MT_2010",
  MsgType_FormResponse = "MT_2020",
  MsgType_Authentication = "MT_4010",
  MsgType_Conversation_Init = "MT_2030",
  MsgType_Receipt = "MT_5010",
  MsgType_Response_Ack = "MT_6010",
}

export enum MessageTypeTitle {
  MsgType_Audio = "Audio",
  MsgType_Document = "Document",
  MsgType_Form = "Form",
  MsgType_Image = "Image",
  MsgType_Video = "Video",
  MsgType_Text = "Text",
  MsgType_Response_Acknowledge_Type = "Response Acknowledge",
  MsgType_LinkPreview = "Link preview",
  MsgType_Conversation_Init = "Conversation",
  MsgType_FormResponse = "FormResponse",
  MsgType_Receipt = "Receipt",
  MsgType_Authentication = "Authentication",
  MsgType_Unknown = "Unknown",
}

export function isUserVisibleMessages(message: Message): boolean {
  if (!message) {
    return false;
  }
  // TODO new-ksdk what are user visible messages?
  return true;
  // return (
  //   message.messageType === KristaMessageType.MsgType_Form ||
  //   message.messageType === KristaMessageType.MsgType_Text ||
  //   message.messageType === KristaMessageType.MsgType_Authentication ||
  //   message.messageType === KristaMessageType.MsgType_Response_Ack
  // );
}
