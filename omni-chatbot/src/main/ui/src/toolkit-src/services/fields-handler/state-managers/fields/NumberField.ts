import { SSF } from "xlsx";
import { NumberFieldAttributes } from "../field-attributes/NumberFieldAttributes";
import { NumberValue } from "../field-values/NumberValue";
import { KristaTypeField } from "./KristaTypeField";
import { ICompositeField } from "./types";
import { FieldTypes } from "../FieldTypes";
import { isDefined } from "../../../../common/utils";
import { Priorities } from "../../Priorities";
import { KSDKFormField } from "../../../messaging/form/KSDKFormField";
import { isValidNumberString } from "../../utils/fields";

export class NumberField extends KristaTypeField<
  NumberFieldAttributes,
  NumberValue
> {
  constructor(
    _fieldType: FieldTypes,
    _field: KSDKFormField,
    _parent?: ICompositeField
  ) {
    super(_fieldType, _field, _parent);
  }

  protected static getPriority(field: KSDKFormField): Priorities {
    switch (field.fieldType) {
      case FieldTypes.NUMBER_FIELD:
      case FieldTypes.CURRENCY_FIELD:
      case FieldTypes.UNIT_FIELD:
        return Priorities.SpecificType;
      default:
        return Priorities.NotSupported;
    }
  }

  protected createAttributes(
    _attributes: Map<string, any>
  ): NumberFieldAttributes {
    return new NumberFieldAttributes(_attributes);
  }

  protected formatValue(): any {
    return NumberField.formatFieldValue(this.value, this.attributes);
  }

  protected createKristaValue(rawValue: number): NumberValue {
    if (!isDefined(rawValue) || !isValidNumberString(rawValue)) {
      return new NumberValue();
    }
    try {
      rawValue = Number(rawValue);
    } catch (ex) {
      return new NumberValue();
    }
    return new NumberValue(rawValue);
  }

  public static formatFieldValue(
    value: NumberValue,
    attributes: NumberFieldAttributes
  ): string {
    if (!isDefined(value.getValue())) {
      return "";
    }
    return SSF.format(attributes.pattern, value.getValue());
  }
}
