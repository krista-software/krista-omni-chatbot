export abstract class DocBase {
  public readonly msgType: string;

  protected constructor(msgType: string) {
    this.msgType = msgType;
  }

  abstract toAttributes(): Map<string, any>;
}
