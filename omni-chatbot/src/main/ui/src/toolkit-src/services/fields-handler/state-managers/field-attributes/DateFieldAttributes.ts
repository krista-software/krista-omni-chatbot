import { isDefined } from "../../../../common/utils";
import { KristaFieldAttributes } from "./KristaFieldAttributes";

export class DateFieldAttributes extends KristaFieldAttributes {
  public static readonly ALLOW_PAST = "allowPast"; // boolean
  public static readonly ALLOW_TODAY = "allowToday"; // boolean
  public static readonly ALLOW_FUTURE = "allowFuture"; // boolean
  public static readonly INCLUDE_TIME_OF_DAY = "includeTimeOfDay"; // boolean
  public static readonly DATE_FORMAT = "dateFormat"; // string
  public static readonly TIMEZONE = "timezone";

  constructor(attributes: Map<string, any>) {
    super(attributes);
  }

  public get includeTimeOfDay(): boolean {
    const _includeTimeOfDay = this.get(DateFieldAttributes.INCLUDE_TIME_OF_DAY);
    return isDefined(_includeTimeOfDay) ? _includeTimeOfDay : false;
  }

  public get allowPast(): boolean {
    const _allowPast = this.get(DateFieldAttributes.ALLOW_PAST);
    return isDefined(_allowPast) ? _allowPast : true;
  }

  public get allowToday(): boolean {
    const _allowToday = this.get(DateFieldAttributes.ALLOW_TODAY);
    return isDefined(_allowToday) ? _allowToday : true;
  }

  public get allowFuture(): boolean {
    const _allowFuture = this.get(DateFieldAttributes.ALLOW_FUTURE);
    return isDefined(_allowFuture) ? _allowFuture : true;
  }

  public get dateFormat(): string {
    return this.get(DateFieldAttributes.DATE_FORMAT);
  }

  public get timezone(): string | undefined {
    const _timezone = this.get(DateFieldAttributes.TIMEZONE);
    return isDefined(_timezone) ? _timezone : undefined;
  }
}
