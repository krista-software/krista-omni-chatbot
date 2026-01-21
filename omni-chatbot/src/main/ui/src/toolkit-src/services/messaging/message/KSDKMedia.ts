export class KSDKMedia {
  constructor(
    readonly mimeType: MediaMimeType,
    readonly title: string,
    readonly mediaId: string,
    readonly attributes: { [key: string]: any }
  ) {}

  static fromJSON(json: any): KSDKMedia | undefined {
    if (!json) {
      return undefined;
    }

    return new KSDKMedia(
      json["mimeType"],
      json["title"],
      json["mediaId"],
      json["attributes"]
    );
  }

  static fromJSONArray(jsonArray: any[]): KSDKMedia[] | undefined {
    if (!jsonArray) {
      return undefined;
    }
    const media = new Array<KSDKMedia>();
    jsonArray.forEach((messageJson) => {
      const mediaItem = this.fromJSON(messageJson);
      if (mediaItem) {
        media.push(mediaItem);
      }
    });
    return media;
  }
}

enum MediaMimeType {
  /**
   * "attributes": {
   *       "fileName": "Text",
   *       "length": "Long",
   *       "width": "Integer",
   *       "height": "Integer",
   *       "blurImage": "Text"
   *     }
   */
  Image = "image",
  /**
   * "attributes": {
   *       "fileName": "Text",
   *       "length": "Number",
   *       "blurImage": "Text"
   *     }
   */
  Video = "video",
  /**
   * "attributes": {
   *       "fileName": "Text",
   *       "length": "Long",
   *       "recorded": "Boolean"
   *     }
   */
  Audio = "audio",
  /**
   * "attributes": {
   *       "imageUrl": "Text",
   *       "pageUrl": "Text",
   *       "title": "Text",
   *       "description": "Text",
   *       "message": "Text"
   *     }
   */
  LinkPreview = "link",
  /**
   * "attributes": {
   *       "fileName": "Text",
   *       "extension": "Text",
   *       "length": "Long"
   *     }
   */
  Document = "document",
}
