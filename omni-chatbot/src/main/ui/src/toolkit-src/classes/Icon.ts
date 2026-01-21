export class Icon {
  url = "";
  mediaId: string | undefined;
  isMediaId = false;
  isSvg = false;

  constructor(uri: string) {
    if (uri) {
      if (uri.startsWith("icon:svg")) {
        this.isMediaId = true;
        this.isSvg = true;
        const splits = uri.split("&");
        if (splits.length > 0) {
          const val = splits[splits.length - 1].split("=");
          if (val.length > 0) {
            this.mediaId = val[val.length - 1];
          }
        }
      } else if (uri.includes("media")) {
        this.mediaId = uri.replace("media:", "");
        this.isMediaId = true;
      } else {
        this.url = uri;
      }
    }
  }

  toString(): string {
    if (this.mediaId) {
      return "media:" + this.mediaId;
    } else {
      return this.url;
    }
  }

  static createWithMediaId(mediaId: string) {
    if (mediaId) {
      return new Icon("media:" + mediaId);
    }
    return null;
  }

  static create(uri: string): Icon {
    // if (String.isNullOrEmpty(uri)) {
    //     return null;
    // }

    return new Icon(uri);
  }
}
