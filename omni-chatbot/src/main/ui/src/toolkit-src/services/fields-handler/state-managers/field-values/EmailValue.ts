import { KristaValue } from "./KristaValue";

export class EmailValue extends KristaValue {
  constructor(protected readonly _value?: string) {
    super();
  }

  getValue(): string | undefined {
    return this._value;
  }

  toResponse(): string | undefined {
    return this._value;
  }

  equals(value: KristaValue): boolean {
    if (!(value instanceof EmailValue)) {
      return false;
    }
    if (value.getValue() !== this.getValue()) {
      return false;
    }

    return true;
  }

  toString(): string {
    return this._value || "";
  }
}
