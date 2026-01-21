import { isDefined } from "../../../../common/utils";
import { KristaValue } from "./KristaValue";

export class UnknownValue extends KristaValue {
  constructor(private readonly _value?: any) {
    super();
  }

  equals(value: KristaValue): boolean {
    return false;
  }

  getValue(): any {
    return this._value;
  }

  toResponse(): any {
    return this._value;
  }

  toString(): string {
    return isDefined(this._value) ? this._value.toString() : "";
  }
}
