import { KristaValue } from "./KristaValue";

export class SwitchValue extends KristaValue {
  constructor(protected readonly _value = false) {
    super();
  }

  getValue(): boolean {
    return this._value;
  }

  toResponse(): boolean {
    return this._value;
  }

  equals(value: KristaValue): boolean {
    if (!(value instanceof SwitchValue)) {
      return false;
    }
    if (value.getValue() !== this.getValue()) {
      return false;
    }

    return true;
  }

  toString(): string {
    return this._value.toString();
  }
}
