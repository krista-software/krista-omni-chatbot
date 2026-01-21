export enum SubmitType {
  submit = "submit",
  path = "path",
  sidebar = "sidebar",
  no_answer = "no_answer",
}

export class KSDKMessageSubmit {
  constructor(readonly type: SubmitType, readonly value?: string) {}

  static fromJSON(json: any): KSDKMessageSubmit | undefined {
    if (!json) {
      return undefined;
    }

    return new KSDKMessageSubmit(json["type"], json["value"]);
  }
}
