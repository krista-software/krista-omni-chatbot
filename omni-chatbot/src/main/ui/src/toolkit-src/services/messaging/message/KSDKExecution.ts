import { KSDKIMessage } from "./KSDKIMessage";
import { KristaId } from "../../../common/KristaId";
import { isDefined } from "../../../common/utils";
import { KSDKLastMessage } from "./KSDKLastMessage";
import { KSDKAccount } from "./KSDKAccount";

export class KSDKExecution extends KSDKIMessage {
  public readonly objectId = KristaId.generateUUID();

  public requiredSync: boolean = false;

  constructor(
    public readonly id: string,
    public title: string,
    public readonly name: string,
    public state: string[], // TODO add possible values
    public lastMessage: KSDKLastMessage,
    public readonly initiator: KSDKAccount,
    public readonly mode: "draft" | "test" | "deploy",
    public readonly startTime: number,
    public readonly endTime?: number
  ) {
    super(id);
  }

  getId(): string {
    return this.id;
  }

  getCreationTime(): number {
    return this.startTime;
  }

  update(newMessage: KSDKExecution): boolean {
    if (!newMessage) {
      return false;
    }
    this.lastMessage = newMessage.lastMessage;
    this.title = newMessage.title;
    this.updateUniqueKey();
    return true;
  }

  // TODO is this required?
  get isRead(): boolean {
    return false;
  }

  get isIncoming(): boolean {
    return true;
  }

  static fromJSON(json: any): KSDKExecution | undefined {
    if (!isDefined(json)) {
      return undefined;
    }

    return new KSDKExecution(
      json["id"],
      json["title"],
      json["name"],
      json["state"],
      KSDKLastMessage.fromJSON(json["lastMessage"])!,
      KSDKAccount.fromJSON(json["initiator"]),
      json["mode"],
      json["startTime"],
      json["endTime"]
    );
  }

  static fromJSONArray(jsonArray: any[]): KSDKExecution[] {
    if (!jsonArray) {
      return [];
    }

    const messages = new Array<KSDKExecution>();
    jsonArray.forEach((messageJson) => {
      const message = this.fromJSON(messageJson);
      if (message) {
        messages.push(message);
      }
    });
    return messages;
  }
}
