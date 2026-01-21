import { KristaId } from "../../../../../../common/KristaId";
import { DocBase } from "./DocBase";
import { MessageTypeTitle } from "../../../../../messaging/message/KristaMessageType";

export class DocDocument extends DocBase {
  private mediaId: KristaId;
  private file: File;
  private extension: string | undefined;
  private length: number;

  constructor(mediaId: KristaId, file: File) {
    super(MessageTypeTitle.MsgType_Document);
    this.mediaId = mediaId;
    this.file = file;
    this.extension = file.name.split(".").pop();
    this.length = file.size;
  }

  toAttributes(): Map<string, any> {
    const attributes = new Map<string, any>();
    attributes.set("fileName", this.file.name);
    attributes.set("mediaId", this.mediaId ? this.mediaId.toString() : null);
    attributes.set("extension", this.extension ? this.extension : null);
    attributes.set("length", this.length);
    return attributes;
  }
}
