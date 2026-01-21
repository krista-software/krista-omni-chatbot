import dayjs from "dayjs";
import { KSDKFormField } from "./../../../messaging/form/KSDKFormField";
import { DateFieldAttributes } from "../field-attributes/DateFieldAttributes";
import { DateValue } from "../field-values/DateValue";
import { FieldTypes } from "../FieldTypes";
import { FieldValue, KristaTypeField } from "./KristaTypeField";
import { ICompositeField } from "./types";
import { correctDateToUTCStart } from "../classes/utils";
import { isDefined } from "../../../../common/utils";
import { Priorities } from "../../Priorities";
import { isValidNumberString } from "../../utils/fields";

export class DateField extends KristaTypeField<DateFieldAttributes, DateValue> {
  constructor(
    _fieldType: FieldTypes,
    _field: KSDKFormField,
    _parent?: ICompositeField
  ) {
    super(_fieldType, _field, _parent);
  }

  protected static getPriority(field: KSDKFormField): Priorities {
    if (field.fieldType === FieldTypes.DATE_FIELD) {
      return Priorities.SpecificType;
    }
    return Priorities.NotSupported;
  }

  protected formatValue(): any {
    return DateField.formatFieldValue(this.value, this.attributes);
  }

  protected createAttributes(
    _attributes: Map<string, any>
  ): DateFieldAttributes {
    return new DateFieldAttributes(_attributes);
  }

  protected createKristaValue(rawValue: number): DateValue {
    if (!isDefined(rawValue) || !isValidNumberString(rawValue)) {
      return new DateValue(undefined);
    }
    try {
      rawValue = Number(rawValue);
    } catch (ex) {
      return new DateValue(undefined);
    }
    return new DateValue(rawValue);
  }

  protected processKristaValue(rawValue: number): FieldValue {
    if (!isDefined(rawValue) || !isValidNumberString(rawValue)) {
      return undefined;
    }
    try {
      rawValue = Number(rawValue);
    } catch (ex) {
      return undefined;
    }
    const timezone = this.attributes.timezone;
    if (this.attributes.includeTimeOfDay) {
      let adjustedDate = rawValue;
      if (timezone) {
        adjustedDate = dayjs(rawValue).tz(timezone, true).valueOf();
      }
      return adjustedDate;
    } else {
      let adjustedDate: number;
      if (timezone) {
        // adjustedDate = dayjs
        //   .tz(dayjs(rawValue).format("YYYY-MM-DDTHH:mm:ss"), timezone)
        //   .startOf("day")
        //   .valueOf();
        adjustedDate = dayjs(rawValue)
          .tz(timezone, true)
          .startOf("day")
          .valueOf();
      } else {
        adjustedDate = dayjs(rawValue).startOf("day").utc(true).valueOf();
      }
      return adjustedDate;
    }
  }

  public static formatFieldValue(
    fieldValue: DateValue,
    attributes: DateFieldAttributes
  ): string {
    const val = fieldValue.getValue();
    if (!val) {
      return "";
    }
    let format = attributes.dateFormat;
    if (!format) {
      format = attributes.includeTimeOfDay ? "lll" : "ll";
    }
    return correctDateToUTCStart(
      val,
      attributes.includeTimeOfDay,
      attributes.timezone
    ).format(format);
  }
}
