import { DateRangeFieldAttributes } from "./DateRangeFieldAttributes";

export class DateTimeRangeFieldAttributes extends DateRangeFieldAttributes {
  public static readonly MAX_DURATION_IN_HOURS = "maxDurationInHours"; // Integer
  public static readonly ALLOW_NOW = "allowNow"; // Boolean

  private readonly _maxDurationInHours: number;
  private readonly _allowNow: boolean;

  constructor(attributes: Map<string, any>) {
    super(attributes);
    this._maxDurationInHours = attributes.get(
      DateTimeRangeFieldAttributes.MAX_DURATION_IN_HOURS
    );
    this._allowNow = attributes.get(DateTimeRangeFieldAttributes.ALLOW_NOW);
  }

  public get allowNow(): boolean {
    return this._allowNow;
  }

  public get maxDurationInHours(): number {
    return this._maxDurationInHours;
  }

  public get includeTimeOfDay(): boolean {
    return true;
  }
}
