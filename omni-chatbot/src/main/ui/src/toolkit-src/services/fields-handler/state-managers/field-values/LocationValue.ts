import { KristaValue } from "./KristaValue";
import { Location } from "../classes/Location";
import { LocationValueJson } from "../types";

export class LocationValue extends KristaValue {
  private readonly location: Location | undefined = undefined;

  constructor(protected readonly _value?: LocationValueJson) {
    super();
    if (_value) {
      this.location = Location.fromJSON(_value);
    }
  }

  getValue(): Location | undefined {
    return this.location;
  }

  toResponse(): LocationValueJson | undefined {
    return this._value;
  }

  equals(/*value: KristaValue*/): boolean {
    return false;
  }

  toString(): string {
    return this.location ? this.location.toString() : "";
  }
}
