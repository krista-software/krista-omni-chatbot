import dayjs from "dayjs";
import { DateTimeRangeFieldAttributes } from "../field-attributes/DateTimeRangeFieldAttributes";
import { DateRangeValue } from "../field-values/DateRangeValue";
import { FieldTypes } from "../FieldTypes";
import { FieldValue, KristaTypeField } from "./KristaTypeField";
import { ICompositeField } from "./types";
import { correctDateToUTCStart } from "../classes/utils";
import { isDefined } from "../../../../common/utils";
import { Priorities } from "../../Priorities";
import { DateRangeJson } from "../types";
import { KSDKFormField } from "../../../messaging/form/KSDKFormField";

export class DateTimeRangeField extends KristaTypeField<
  DateTimeRangeFieldAttributes,
  DateRangeValue
> {
  constructor(
    _fieldType: FieldTypes,
    _field: KSDKFormField,
    _parent?: ICompositeField
  ) {
    super(_fieldType, _field, _parent);
  }

  protected static getPriority(field: KSDKFormField): Priorities {
    if (field.fieldType === FieldTypes.DATE_TIME_RANGE_FIELD) {
      return Priorities.SpecificType;
    }
    return Priorities.NotSupported;
  }

  protected formatValue(): any {
    return DateTimeRangeField.formatFieldValue(this.value, this.attributes);
  }

  protected createAttributes(
    _attributes: Map<string, any>
  ): DateTimeRangeFieldAttributes {
    return new DateTimeRangeFieldAttributes(_attributes);
  }

  protected createKristaValue(
    rawValue: Omit<DateRangeJson, "type">
  ): DateRangeValue {
    if (!isDefined(rawValue)) {
      return new DateRangeValue();
    }
    try {
      rawValue = { from: Number(rawValue.from), to: Number(rawValue.to) };
    } catch (ex) {
      return new DateRangeValue();
    }

    return new DateRangeValue(rawValue.from, rawValue.to);
  }

  protected processKristaValue(
    rawValue: Omit<DateRangeJson, "type">
  ): FieldValue {
    if (!isDefined(rawValue)) {
      return undefined;
    }
    try {
      rawValue = { from: Number(rawValue.from), to: Number(rawValue.to) };
    } catch (ex) {
      return undefined;
    }

    // for only date send the time in utc start date
    let start = rawValue.from;
    let end = rawValue.to;
    const timezone = this.attributes.timezone;
    if (timezone) {
      start = dayjs(rawValue.from).tz(timezone, true).valueOf();
      end = dayjs(rawValue.to).tz(timezone, true).valueOf();
    }
    return { from: start, to: end };
  }

  public static formatFieldValue(
    fieldValue: DateRangeValue,
    attributes: DateTimeRangeFieldAttributes
  ): string {
    const val = fieldValue.getValue();
    if (!val) {
      return "";
    }

    const dateFormat = attributes.dateFormat || "lll";
    const start = correctDateToUTCStart(
      val.from,
      true,
      attributes.timezone
    ).format(dateFormat);
    const end = correctDateToUTCStart(val.to, true, attributes.timezone).format(
      dateFormat
    );
    return `${start} - ${end}`;
  }
}
