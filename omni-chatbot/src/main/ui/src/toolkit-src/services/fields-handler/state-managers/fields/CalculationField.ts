import { CalculationFieldAttributes } from "../field-attributes/CalculationFieldAttributes";
import { CalculationValue } from "../field-values/CalculationValue";
import { KristaTypeField } from "./KristaTypeField";
import { ICompositeField } from "./types";
import { FieldTypes } from "../FieldTypes";
import { Priorities } from "../../Priorities";
import { KSDKFormField } from "../../../messaging/form/KSDKFormField";

export class CalculationField extends KristaTypeField<
  CalculationFieldAttributes,
  CalculationValue
> {
  constructor(
    _fieldType: FieldTypes,
    _field: KSDKFormField,
    _parent?: ICompositeField
  ) {
    super(_fieldType, _field, _parent);
  }

  protected static getPriority(field: KSDKFormField): Priorities {
    if (field.fieldType === FieldTypes.CALCULATION_FIELD) {
      return Priorities.SpecificType;
    }
    return Priorities.NotSupported;
  }

  protected createAttributes(
    _attributes: Map<string, any>
  ): CalculationFieldAttributes {
    return new CalculationFieldAttributes(_attributes);
  }

  protected createKristaValue(rawValue: number): CalculationValue {
    return new CalculationValue(rawValue);
  }
}
