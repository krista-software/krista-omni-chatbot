import dayjs from "dayjs";
import { TypeDateRange } from "../field-attributes/DateRangeFieldAttributes";
import { DateRangeJson } from "../types";
import { KristaValue } from "./KristaValue";

export class DateRangeValue extends KristaValue {
  public static readonly Type = "com.krista.net.model.fieldschemas.DateRange";

  constructor(protected readonly _from?: number, protected _to?: number) {
    super();
  }

  get from() {
    return this._from;
  }

  get to() {
    return this._to;
  }

  getValue(): Omit<DateRangeJson, "type"> | undefined {
    if (!this.from || !this.to) {
      return undefined;
    }
    return {
      from: this.from,
      to: this.to,
    };
  }

  toResponse(): DateRangeJson | undefined {
    if (!this.from || !this.to) {
      return undefined;
    }
    return {
      type: TypeDateRange.Type,
      from: this.from,
      to: this.to,
    };
  }

  equals(value: KristaValue): boolean {
    if (!(value instanceof DateRangeValue)) {
      return false;
    }
    if (value.from !== this.from || value.to !== this.to) {
      return false;
    }

    return true;
  }

  toString(): string {
    if (!this.from || !this.to) {
      return "";
    }
    return `from: ${dayjs(this.from).toLocaleString()} to: ${dayjs(
      this.to
    ).toLocaleString()}`;
  }

  static fromJson(json: DateRangeJson): DateRangeValue | undefined {
    if (!json) {
      return undefined;
    }
    return new DateRangeValue(json["from"], json["to"]);
  }
}
