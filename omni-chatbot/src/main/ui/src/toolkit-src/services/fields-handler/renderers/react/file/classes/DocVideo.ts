import { KristaId } from "../../../../../../common/KristaId";
import { DocBase } from "./DocBase";
import { MessageTypeTitle } from "../../../../../messaging/message/KristaMessageType";
import { MediaMeta } from "./MediaMeta";

export class DocVideo extends DocBase {
  private mediaId: KristaId;
  private file: File;
  private width: number;
  private height: number;
  private blurImageStr: string;

  constructor(mediaId: KristaId, file: File, meta: MediaMeta) {
    super(MessageTypeTitle.MsgType_Video);
    this.mediaId = mediaId;
    this.file = file;
    this.width = meta.width;
    this.height = meta.height;
    this.blurImageStr = meta.blur;
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

  // processMessage(msg: CacheMessage, callback) {
  //     this.docHook.getMediaService().uploadFile(msg.wsId, this.mediaId, this.file).subscribe(result => {
  //         if (result) {
  //             callback(msg);
  //         }
  //     });
  // }
}
