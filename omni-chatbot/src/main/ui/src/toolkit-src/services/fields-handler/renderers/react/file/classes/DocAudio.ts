import { DocBase } from "./DocBase";
import { KristaId } from "../../../../../../common/KristaId";
import { MessageTypeTitle } from "../../../../../messaging/message/KristaMessageType";

export class DocAudio extends DocBase {
  private mediaId: KristaId;
  private file: File;
  private recorded: boolean;

  constructor(mediaId: KristaId, file: File, recorded: boolean = false) {
    super(MessageTypeTitle.MsgType_Audio);
    this.mediaId = mediaId;
    this.file = file;
    this.recorded = recorded;
  }

  toAttributes(): Map<string, any> {
    const attributes = new Map<string, any>();
    attributes.set("fileName", this.file.name);
    attributes.set("mediaId", this.mediaId ? this.mediaId.toString() : null);
    attributes.set("length", this.file.size);
    attributes.set("recorded", this.recorded);
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
