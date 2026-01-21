import { KristaFieldAttributes } from "./KristaFieldAttributes";
import { isDefined } from "../../../../common/utils";

export class TimeFieldAttributes extends KristaFieldAttributes {
  public static readonly TIMEZONE = "timezone";

  constructor(attributes: Map<string, any>) {
    super(attributes);
  }

  public get timezone(): string | undefined {
    const _timezone = this.get(TimeFieldAttributes.TIMEZONE);
    return isDefined(_timezone) ? _timezone : undefined;
  }
}
