import { KristaTypeField } from "./KristaTypeField";
import { KristaFieldAttributes } from "../field-attributes/KristaFieldAttributes";
import { KristaValue } from "../field-values/KristaValue";
import { FieldTypes } from "../FieldTypes";
import { UnknownValue } from "../field-values/UnknownValue";
import { Priorities } from "../../Priorities";
import { ICompositeField } from "./types";
import { KSDKFormField } from "../../../messaging/form/KSDKFormField";

export class UnknownField extends KristaTypeField<
  KristaFieldAttributes,
  KristaValue
> {
  constructor(
    _fieldType: FieldTypes,
    _field: KSDKFormField,
    _parent?: ICompositeField
  ) {
    super(_fieldType, _field, _parent);
  }

  protected createAttributes(
    _attributes: Map<string, any>
  ): KristaFieldAttributes {
    return new KristaFieldAttributes(_attributes);
  }

  protected static getPriority(field: KSDKFormField): Priorities {
    if (field.fieldType === FieldTypes.UNKNOWN_FIELD) {
      return Priorities.SpecificType;
    }
    return Priorities.NotSupported;
  }

  protected createKristaValue(rawValue: any): KristaValue {
    return new UnknownValue(rawValue);
  }

  protected formatValue(): any {
    return this.value;
  }
}
