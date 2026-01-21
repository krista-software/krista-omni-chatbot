import {KristaValue} from "./KristaValue";
import {StreamValueJson} from "../types.ts";

export class StreamValue extends KristaValue {
  constructor(readonly _value: StreamValueJson) {
    super();
  }

  public getValue(): StreamValueJson | undefined {
    return this._value;
  }

  public toResponse(): StreamValueJson | undefined {
    return this._value;
  }

  public equals(value: KristaValue): boolean {
    if (!(value instanceof StreamValue)) {
      return false;
    }
    return (value as StreamValue)._value?.streamId === this._value?.streamId;
  }

  public toString(): string {
    return this._value?.streamId || "";
  }
}
