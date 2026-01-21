import { ValueJson } from "../../types";
import { CompositeValue } from "../CompositeValue";

export class TableRowValue extends CompositeValue {
  constructor(
    public readonly entityId?: string,
    public readonly primaryKey?: string
  ) {
    super();
  }

  toResponse(): ValueJson | undefined {
    if (this.subfieldValue.size === 0) {
      return undefined;
    }
    const response = JSON.parse("{}");
    this.subfieldValue.forEach((value, key) => {
      response[key] = value.toResponse();
    });
    if (this.entityId && this.primaryKey) {
      response[this.entityId] = this.primaryKey;
    }
    return response;
  }
}
