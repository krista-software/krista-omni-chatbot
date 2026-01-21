import dayjs from "dayjs";
import { KristaValue } from "./KristaValue";

export class DateValue extends KristaValue {
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
    if (!(value instanceof DateValue)) {
      return false;
    }
    if (value.getValue() !== this.getValue()) {
      return false;
    }

    return true;
  }

  toString(): string {
    return this._value ? dayjs(this._value).toLocaleString() : "";
  }

  static from(timestamp: number): DateValue {
    return new DateValue(timestamp);
  }
}
