import { KristaId } from "../../../common/KristaId";
import { StepExecutionMeta } from "../message/StepExecutionMeta";

export class MessageMeta {
  constructor(
    readonly messageId: KristaId,
    readonly messageType: KristaId,
    readonly toInboxId: KristaId,
    readonly fromAccountId: KristaId,
    readonly fromInboxId: KristaId,
    readonly creationTime: number,
    readonly stepExecutionMeta?: StepExecutionMeta
  ) {}

  static fromJSON(json: any): MessageMeta | undefined {
    if (!json) {
      return undefined;
    }
    return new MessageMeta(
      KristaId.parse(json["messageId"]),
      KristaId.parse(json["messageType"]),
      KristaId.parse(json["toInboxId"]),
      KristaId.parse(json["fromAccountId"]),
      KristaId.parse(json["fromInboxId"]),
      json["creationTime"],
      StepExecutionMeta.fromJSON(json["stepExecutionMeta"])
    );
  }

  static fromJSONArray(jsonArray: any[]): MessageMeta[] {
    if (!jsonArray) {
      return [];
    }

    const messageMetaList = new Array<MessageMeta>();
    jsonArray.forEach((meta) => {
      const metaObj = MessageMeta.fromJSON(meta);
      if (metaObj) {
        messageMetaList.push(metaObj);
      }
    });
    return messageMetaList;
  }
}
