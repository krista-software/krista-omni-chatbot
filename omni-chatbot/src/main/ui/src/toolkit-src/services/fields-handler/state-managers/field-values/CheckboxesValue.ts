import { KristaValue } from "./KristaValue";
import { arrayEquals } from "../classes/utils";

export class CheckboxesValue extends KristaValue {
  constructor(private readonly _value?: string[]) {
    super();
  }

  getValue(): string[] | undefined {
    return this._value;
  }

  toResponse(): string[] | undefined {
    return this._value;
  }

  equals(value: KristaValue): boolean {
    if (!value || !this._value) {
      return false;
    }
    return arrayEquals(this._value, value.getValue());
  }

  toString(): string {
    if (this._value && Array.isArray(this._value) && this._value.length > 0) {
      return this._value.join(", ");
    }
    return "";
  }
}
