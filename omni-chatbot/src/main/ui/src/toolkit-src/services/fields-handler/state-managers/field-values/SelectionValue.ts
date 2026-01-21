import { KristaValue } from "./KristaValue";
import { EntityValue } from "./EntityValue";
import { EntityValueJson } from "../types";

export class SelectionValue extends KristaValue {
  constructor(protected readonly _value?: EntityValue | EntityValue[]) {
    super();
  }

  equals(/*value: KristaValue*/): boolean {
    return false;
  }

  getValue(): EntityValue | EntityValue[] | undefined {
    return this._value;
  }

  toResponse(): EntityValueJson | EntityValueJson[] | undefined {
    if (!this._value) {
      return undefined;
    }
    if (!Array.isArray(this._value)) {
      return this._value && this._value.toResponse
        ? this._value.toResponse()
        : undefined;
    }
    const responseArray: EntityValueJson[] = [];
    this._value.forEach((entity) => {
      const res = entity.toResponse();
      if (res) {
        responseArray.push(res);
      }
    });
    return responseArray;
  }

  toString(): string {
    if (!this._value) {
      return "";
    }
    if (!Array.isArray(this._value)) {
      return this._value && this._value.toString ? this._value.toString() : "";
    }
    return this._value.map((entity) => entity.toString()).join(",");
  }
}
