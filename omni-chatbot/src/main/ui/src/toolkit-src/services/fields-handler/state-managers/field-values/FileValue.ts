import { FileValueJson } from "../types";
import { KristaValue } from "./KristaValue";

export class FileValue extends KristaValue {
  constructor(protected readonly _value?: FileValueJson[]) {
    super();
  }

  getValue(): FileValueJson[] | undefined {
    return this._value;
  }

  toResponse(): FileValueJson[] | undefined {
    return this._value;
  }

  equals(/*value: KristaValue*/): boolean {
    return false;
  }

  toString(): string {
    if (!this._value || !Array.isArray(this._value)) {
      return "";
    }
    return this._value.map((json) => json["fileName"]).join(", ");
  }
}
