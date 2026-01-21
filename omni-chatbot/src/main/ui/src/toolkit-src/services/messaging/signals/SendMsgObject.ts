export abstract class SendMsgObject {
  protected constructor(
    public readonly msgTypeId: string,
    public readonly typeName: string
  ) {}

  abstract getAttributes(): Map<string, any>;
}
