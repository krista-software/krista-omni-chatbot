import { KristaFieldValueResolver } from "../../fields-handler/web-components/KristaFieldValueResolver";
import { KSDKAccount } from "./KSDKAccount";

// TODO is "state" required?
export class KSDKLastMessage {
  constructor(
    public summary: string,
    public readonly creationTime: number,
    public readonly sender: KSDKAccount,
    public readonly ephemeral?: { start: number; end: number }) {
    this.summary = KristaFieldValueResolver.escapeNestedKristaField(this.summary);
  }

  static fromJSON(json: any): KSDKLastMessage | undefined {
    if (!json) {
      return undefined;
    }

    return new KSDKLastMessage(
      json["summary"],
      json["creationTime"],
      KSDKAccount.fromJSON(json["sender"]),
      json["ephemeral"]
    );
  }
}
