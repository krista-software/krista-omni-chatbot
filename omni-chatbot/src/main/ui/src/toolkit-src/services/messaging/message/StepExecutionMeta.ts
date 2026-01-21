import { KristaId } from "../../../common/KristaId";
import { isDefined } from "../../../common/utils";

// TODO Delete this file
export class StepExecutionMeta {
  public readonly allowChat = false;

  constructor(
    public readonly sourceJson: any,
    public readonly executionId: KristaId,
    readonly branch: string[],
    readonly threads: string[]
  ) {
    this.allowChat = sourceJson["allowChat"];
  }

  getExecutionId(): KristaId {
    return this.executionId;
  }

  getConversationTitle(): string {
    return this.sourceJson["conversationTitle"]
      ? this.sourceJson["conversationTitle"]
      : "";
  }

  getConversationDefinitionId(): string | undefined {
    return this.sourceJson["conversationDefinitionId"]
      ? this.sourceJson["conversationDefinitionId"]
      : undefined;
  }

  getExecutionMode(): string {
    return this.sourceJson["executionMode"] || "";
  }

  getStepTypeId(): string {
    return this.sourceJson["stepTypeId"] || "";
  }

  hasTestData() {
    return this.sourceJson["testData"] ? this.sourceJson["testData"] : false;
  }

  getUniqueMessageKey() {
    return this.sourceJson["uniqueMessageKey"]
      ? this.sourceJson["uniqueMessageKey"]
      : null;
  }

  public toJSON(): any {
    return this.sourceJson;
  }

  static fromJSON(json: any): StepExecutionMeta | undefined {
    if (!isDefined(json)) {
      return undefined;
    }

    return new StepExecutionMeta(
      json,
      KristaId.parse(json["conversationId"]),
      json["branch"],
      json["thread"]
    );
  }
}
