import { KSDKFormField } from "./../services/messaging/form/KSDKFormField";
import { Icon } from "./Icon";

export class FieldValues {
  constructor(
    public readonly bestMatchContent: string,
    public readonly field: KSDKFormField,
    public readonly type: number
  ) {}

  static fromJSON(json: any): FieldValues | undefined {
    if (!json) {
      return undefined;
    }

    return new FieldValues(
      json["bestMatchContent"],
      KSDKFormField.fromJSON(json["field"])!,
      json["type"]
    );
  }

  static fromJSONArray(jsonArray: any[]): FieldValues[] {
    if (!jsonArray) {
      return [];
    }

    const values = new Array<FieldValues>();
    jsonArray.forEach((json) => {
      const value = this.fromJSON(json);
      if (value) {
        values.push(value);
      }
    });
    return values;
  }
}

export class ConversationMetaNLP {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly mode: "draft" | "test" | "deploy",
    public readonly description: string,
    public readonly topicId: string,
    public readonly fieldValues: FieldValues[],
    public readonly icon?: Icon
  ) {}

  static fromJSON(json: any): ConversationMetaNLP | undefined {
    if (!json) {
      return undefined;
    }

    return new ConversationMetaNLP(
      json["id"],
      json["name"],
      json["mode"],
      json["description"],
      json["topicId"],
      FieldValues.fromJSONArray(json["fieldValues"])!,
      Icon.create(json["icon"])
    );
  }

  static fromJSONArray(jsonArray: any[]): ConversationMetaNLP[] {
    if (!jsonArray) {
      return [];
    }

    const metaArray = new Array<ConversationMetaNLP>();
    jsonArray.forEach((json) => {
      const meta = this.fromJSON(json);
      if (meta) {
        metaArray.push(meta);
      }
    });
    return metaArray;
  }
}
