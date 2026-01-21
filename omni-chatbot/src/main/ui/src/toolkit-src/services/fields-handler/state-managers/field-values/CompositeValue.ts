import { KristaValue } from "./KristaValue";
import { BaseCompositeValue } from "./BaseCompositeValue";
import { ValueJson } from "../types";
import { isDefined } from "../../../../common/utils";

export class CompositeValue extends BaseCompositeValue {
  protected readonly subfieldValue = new Map<string, KristaValue>();

  constructor() {
    super();
  }

  isEmpty() {
    return this.subfieldValue.size === 0;
  }

  equals(value: KristaValue): boolean {
    return false;
  }

  setFieldValue(fieldId: string, kristaValue: KristaValue) {
    this.subfieldValue.set(fieldId, kristaValue);
  }

  getFieldValue(fieldId: string): KristaValue | undefined {
    return this.subfieldValue.get(fieldId);
  }

  getValue(): any {
    const value = new Map<string, any>();
    this.subfieldValue.forEach((fieldValue, fieldId) => {
      value.set(fieldId, fieldValue.getValue());
    });
    return value;
  }

  toResponse(): ValueJson | undefined {
    if (this.subfieldValue.size === 0) {
      return undefined;
    }
    const response = JSON.parse("{}");
    this.subfieldValue.forEach((value, key) => {
      response[key] = value.toResponse();
    });
    return response;
  }

  toString(): string {
    let toString = "";
    this.subfieldValue.forEach((value, key) => {
      if (isDefined(value)) {
        toString += `${key}: ${value.toString()}, `;
      }
    });
    return toString;
  }
}
