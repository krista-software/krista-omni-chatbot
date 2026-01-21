import { StreamFieldAttributes } from "../field-attributes/StreamFieldAttributes";
import { KristaValue } from "./KristaValue";

export class StreamFieldValue extends KristaValue {
  constructor(
    protected readonly _value?: string,
    readonly attributes?: StreamFieldAttributes
  ) {
    super();
  }

  public getValue(): string | undefined {
    return this._value;
  }
  public toResponse(): string | undefined {
    return this._value;
  }
  public equals(value: KristaValue): boolean {
    if (!(value instanceof StreamFieldValue)) {
      return false;
    }
    if (value.getValue() !== this.getValue()) {
      return false;
    }

    return true;
  }
  public toString(): string {
    return this._value || "";
  }
}
