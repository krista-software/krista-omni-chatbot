import { FieldTypes } from "../services/fields-handler/state-managers/FieldTypes";

export class ContextVariable {
  constructor(
    public readonly id: string,
    public readonly label: string,
    public readonly fieldType: FieldTypes,
    public readonly conversation: { id: string; name: string }
  ) {}

  static fromJSON(json: any): ContextVariable | undefined {
    if (!json) {
      return undefined;
    }

    return new ContextVariable(
      json["id"],
      json["label"],
      json["fieldType"],
      json["conversation"]
    );
  }

  static fromJSONArray(jsonArray: any[]): ContextVariable[] {
    if (!jsonArray) {
      return [];
    }

    const contextVariables = new Array<ContextVariable>();
    jsonArray.forEach((json) => {
      const contextVariable = this.fromJSON(json);
      if (contextVariable) {
        contextVariables.push(contextVariable);
      }
    });
    return contextVariables;
  }
}
