import { TextFieldAttributes } from "../field-attributes/TextFieldAttributes";
import { KristaValue } from "./KristaValue";

export class TextValue extends KristaValue {
  constructor(
    protected readonly _value?: string,
    readonly attributes?: TextFieldAttributes
  ) {
    super();
  }

  getValue(): string | undefined {
    return this._value;
  }

  toResponse(): string | undefined {
    let val = this._value;
    if (this.attributes && val) {
      if (this.attributes.trim && typeof val === "string") {
        val = val.trim();
      }
      if (this.attributes.doAutoCapitalization) {
        val =
          val && val.length > 0
            ? val.charAt(0).toUpperCase() + val.slice(1)
            : undefined;
      }
    }
    return val;
  }

  equals(value: KristaValue): boolean {
    if (!(value instanceof TextValue)) {
      return false;
    }
    if (value.getValue() !== this.getValue()) {
      return false;
    }

    return true;
  }

  toString(): string {
    let val = this._value || "";
    if (this.attributes && val) {
      if (this.attributes.trim) {
        val = val.trim();
      }
      if (this.attributes.doAutoCapitalization) {
        val =
          val && val.length > 0
            ? val.charAt(0).toUpperCase() + val.slice(1)
            : "";
      }
    }
    return val;
  }
}
