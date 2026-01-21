import { isDefined } from "../../../../common/utils";
import { KristaValue } from "./KristaValue";

export class NumberValue extends KristaValue {
  constructor(protected readonly _value?: number) {
    super();
  }

  getValue(): number | undefined {
    return this._value;
  }

  toResponse(): number | undefined {
    return this._value;
  }

  equals(value: KristaValue): boolean {
    if (!(value instanceof NumberValue)) {
      return false;
    }
    if (value.getValue() !== this.getValue()) {
      return false;
    }

    return true;
  }

  toString(): string {
    return isDefined(this._value) ? this._value!.toString() : "";
  }
}
