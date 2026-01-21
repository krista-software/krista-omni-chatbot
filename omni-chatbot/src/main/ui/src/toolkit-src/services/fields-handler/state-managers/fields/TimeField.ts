import dayjs from "dayjs";
import { TimeFieldAttributes } from "../field-attributes/TimeFieldAttributes";
import { TimeValue } from "../field-values/TimeValue";
import { FieldValue, KristaTypeField } from "./KristaTypeField";
import { FieldTypes } from "../FieldTypes";
import { correctDateToUTCStart } from "../classes/utils";
import { isDefined } from "../../../../common/utils";
import { Priorities } from "../../Priorities";
import { ICompositeField } from "./types";
import { KSDKFormField } from "../../../messaging/form/KSDKFormField";
import { isValidNumberString } from "../../utils/fields";

export class TimeField extends KristaTypeField<TimeFieldAttributes, TimeValue> {
  constructor(
    _fieldType: FieldTypes,
    _field: KSDKFormField,
    _parent?: ICompositeField
  ) {
    super(_fieldType, _field, _parent);
  }

  protected static getPriority(field: KSDKFormField): Priorities {
    if (field.fieldType === FieldTypes.TIME_FIELD) {
      return Priorities.SpecificType;
    }
    return Priorities.NotSupported;
  }

  protected createAttributes(
    _attributes: Map<string, any>
  ): TimeFieldAttributes {
    return new TimeFieldAttributes(_attributes);
  }

  protected formatValue(): any {
    return TimeField.formatFieldValue(this.value, this.attributes);
  }

  protected createKristaValue(rawValue: number): TimeValue {
    if (!isDefined(rawValue) || !isValidNumberString(rawValue)) {
      return new TimeValue();
    }
    try {
      rawValue = Number(rawValue);
    } catch (ex) {
      return new TimeValue();
    }

    return new TimeValue(rawValue);
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
    let adjustedDate = rawValue;
    if (timezone) {
      adjustedDate = dayjs(rawValue).tz(timezone, true).valueOf();
    }
    return adjustedDate;
  }

  public static formatFieldValue(
    value: TimeValue,
    attributes: TimeFieldAttributes
  ): string {
    const val = value.getValue();
    if (!val) {
      return "";
    }

    return correctDateToUTCStart(val, true, attributes.timezone).format(
      "hh:mm A"
    );
  }
}
