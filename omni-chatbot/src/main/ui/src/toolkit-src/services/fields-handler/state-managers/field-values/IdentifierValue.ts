import { IdentifierFieldAttributes } from "../field-attributes/IdentifierFieldAttributes";
import { KristaValue } from "./KristaValue";

export class IdentifierValue extends KristaValue {
  constructor(
    protected readonly _value?: string,
    readonly attributes?: IdentifierFieldAttributes
  ) {
    super();
  }

  getValue(): string | undefined {
    return this._value;
  }

  toResponse(): string | undefined {
    let val = this._value;
    if (this.attributes) {
      if (this.attributes.trim && typeof val === "string") {
        val = val.trim();
      }
    }
    return val;
  }

  equals(value: KristaValue): boolean {
    if (!(value instanceof IdentifierValue)) {
      return false;
    }
    if (value.getValue() !== this.getValue()) {
      return false;
    }

    return true;
  }

  toString(): string {
    let val = this._value || "";
    if (this.attributes && this.attributes.trim) {
      val = val.trim();
    }
    return val;
  }
}
