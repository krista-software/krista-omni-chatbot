import { KristaValue } from "./KristaValue";
import { PhoneNumber } from "../classes/PhoneNumber";
import { PhoneNumberJson } from "../types";

export class PhoneValue extends KristaValue {
  readonly phoneNumber: PhoneNumber | undefined = undefined;

  constructor(protected readonly _value?: PhoneNumberJson) {
    super();
    if (this._value) {
      this.phoneNumber = PhoneNumber.fromJSON(this._value);
    }
  }

  getValue(): PhoneNumberJson | undefined {
    return this._value;
  }

  toResponse(): PhoneNumberJson | undefined {
    return this._value;
  }

  equals(value: KristaValue): boolean {
    if (!(value instanceof PhoneValue)) {
      return false;
    }

    return false;
  }

  toString(): string {
    return this.phoneNumber ? this.phoneNumber.toString() : "";
  }
}
