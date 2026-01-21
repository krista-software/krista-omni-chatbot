import { KSDKMedia } from "./../services/messaging/message/KSDKMedia";
import { KSDKForm } from "./../services/messaging/form/KSDKForm";
import { KSDKExecutionMeta } from "../services/messaging/message/KSDKExecutionMeta";

// TODO paths, sideConversations, media - empty array or no property?
export class Conversation {
  constructor(
    public readonly id: string,
    public readonly inboxId: string,
    public readonly message: string,
    public readonly form: KSDKForm,
    public readonly executionMeta: KSDKExecutionMeta,
    public readonly paths: string[],
    public readonly sideConversations: string[],
    public readonly media: KSDKMedia[]
  ) {}

  static fromJSON(json: any): Conversation | undefined {
    if (!json) {
      return undefined;
    }

    return new Conversation(
      json["id"],
      json["inboxId"],
      json["message"],
      KSDKForm.fromJSON(json["form"])!,
      KSDKExecutionMeta.fromJSON(json["executionMeta"])!,
      json["paths"],
      json["sideConversations"],
      KSDKMedia.fromJSONArray(json["media"])!
    );
  }
}
