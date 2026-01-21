import { CameraFieldJson } from "../types";

export class CameraFile {
  constructor(
    public readonly mediaId: string,
    public readonly filename: string,
    public readonly length: number,
    public readonly width: number,
    public readonly height: number,
    public readonly blurImageStr: string
  ) {}

  toJSON(): CameraFieldJson {
    return {
      mediaId: this.mediaId,
      filename: this.filename,
      length: this.length,
      width: this.width,
      height: this.height,
      blurImageStr: this.blurImageStr,
    };
  }

  toString() {
    return this.filename;
  }

  static fromJSON(json: CameraFieldJson): CameraFile | undefined {
    if (!json) {
      return undefined;
    }

    const mediaId = json["mediaId"];
    const filename = json["filename"];
    const length = json["length"];
    const width = json["width"];
    const height = json["height"];
    const blurImage = json["blurImageStr"];
    return new CameraFile(mediaId, filename, length, width, height, blurImage);
  }
}
