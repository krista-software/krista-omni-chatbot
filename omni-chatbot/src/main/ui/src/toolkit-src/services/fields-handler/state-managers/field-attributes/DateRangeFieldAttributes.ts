import { DateFieldAttributes } from "./DateFieldAttributes";
import { DateRangeJson } from "../types";
import { isDefined } from "../../../../common/utils";

export class DateRangeFieldAttributes extends DateFieldAttributes {
  public static readonly DEFAULT_TIME_SPAN = "defaultTimeSpan"; // Integer
  public static readonly ALLOWED_RANGE = "allowedRange"; // com.krista.net.model.fieldschemas.DateRange
  public static readonly MAX_DURATION_IN_DAYS = "maxDurationInDays"; // Integer
  public static readonly REFERENCING_NAME = "referencingName"; // String[]

  private readonly _defaultTimeSpan: number;
  private readonly _maxDurationInDays: number;
  private readonly _allowedRange: TypeDateRange | undefined;
  private readonly _referenceName: string[] = [];

  constructor(attributes: Map<string, any>) {
    super(attributes);
    this._defaultTimeSpan = attributes.get(
      DateRangeFieldAttributes.DEFAULT_TIME_SPAN
    );
    this._maxDurationInDays = attributes.get(
      DateRangeFieldAttributes.MAX_DURATION_IN_DAYS
    );
    this._allowedRange = TypeDateRange.create(
      attributes.get(DateRangeFieldAttributes.ALLOWED_RANGE)
    );
    const referenceName: Array<string> = attributes.get(
      DateRangeFieldAttributes.REFERENCING_NAME
    );
    if (referenceName) {
      this._referenceName = referenceName;
    }
  }

  public get defaultTimeSpan(): number {
    let span = isDefined(this._defaultTimeSpan) ? this._defaultTimeSpan : 1;
    if (this._maxDurationInDays < span) {
      span = this._maxDurationInDays;
    }
    return span; // default 1
  }

  public get maxDurationInDays(): number {
    return this._maxDurationInDays;
  }

  public get allowedRange(): TypeDateRange | undefined {
    return this._allowedRange;
  }

  public get referenceString(): string {
    if (this._referenceName.length > 0) {
      return this._referenceName[0] + " : " + this._referenceName[1];
    }
    return "";
  }
}

export class TypeDateRange {
  public static Type: DateRangeJson["type"] =
    "com.krista.net.model.fieldschemas.DateRange";

  constructor(public readonly from: number, public readonly to: number) {}

  fromDate(): Date {
    return new Date(this.from);
  }

  toDate(): Date {
    return new Date(this.to);
  }

  toJSON(): DateRangeJson {
    return {
      type: TypeDateRange.Type,
      from: this.from,
      to: this.to,
    };
  }

  static create(json: DateRangeJson): TypeDateRange | undefined {
    if (!json) {
      return undefined;
    }
    return new TypeDateRange(json["from"], json["to"]);
  }
}
