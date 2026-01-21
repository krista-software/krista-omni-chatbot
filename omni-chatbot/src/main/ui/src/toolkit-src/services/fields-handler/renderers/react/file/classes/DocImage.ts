import { KristaId } from "../../../../../../common/KristaId";
import { DocBase } from "./DocBase";
import { MessageTypeTitle } from "../../../../../messaging/message/KristaMessageType";

export class DocImage extends DocBase {
  public readonly mediaId: KristaId;
  public readonly file: File;
  public readonly width: number;
  public readonly height: number;
  public readonly blurImageStr: string;

  constructor(
    mediaId: KristaId,
    file: File,
    width: number,
    height: number,
    blurImageStr: string
  ) {
    super(MessageTypeTitle.MsgType_Image);
    this.mediaId = mediaId;
    this.file = file;
    this.width = width;
    this.height = height;
    this.blurImageStr = blurImageStr;
  }

  toAttributes(): Map<string, any> {
    const attributes = new Map<string, any>();
    attributes.set("fileName", this.file.name);
    attributes.set("mediaId", this.mediaId ? this.mediaId.toString() : null);
    attributes.set("length", this.file.size);
    attributes.set("width", this.width);
    attributes.set("height", this.height);
    attributes.set("blurImage", this.blurImageStr);
    return attributes;
  }
}
