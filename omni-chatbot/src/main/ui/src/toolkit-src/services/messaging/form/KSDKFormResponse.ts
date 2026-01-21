import { KristaId } from "../../../common/KristaId";
import { SubmitType } from "../message/KSDKMessageSubmit";

export class KSDKFormResponse {
  constructor(
    public readonly fieldValues: Map<string, any>,
    public submitType: SubmitType | null = null,
    public submitValue: string | null = null,
    public fromAccountId: KristaId | null = null
  ) {
    if (!fieldValues) {
      this.fieldValues = new Map<string, any>();
    }
  }

  getFieldValue(fieldId: string): any {
    return this.fieldValues.get(fieldId);
  }

  toJSON(): any {
    return {
      submit: {
        type: this.submitType,
        value: this.submitValue,
      },
      values: this.prepareValueJson(),
    };
  }

  private prepareValueJson() {
    if (!this.fieldValues) {
      return null;
    }

    return this.internalPrepareJsonObject(this.fieldValues);
  }

  private internalPrepareJsonObject(fieldValueMap: Map<string, any>): any {
    const jsonObj = JSON.parse("{}");
    fieldValueMap.forEach((value, fieldId) => {
      if (value instanceof Map) {
        jsonObj[fieldId] = this.internalPrepareJsonObject(value);
      } else {
        jsonObj[fieldId] = value;
      }
    });
    return jsonObj;
  }
}
