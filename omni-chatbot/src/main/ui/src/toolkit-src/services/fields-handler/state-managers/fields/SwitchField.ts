import { SwitchFieldAttributes } from "../field-attributes/SwitchFieldAttributes";
import { SwitchValue } from "../field-values/SwitchValue";
import { KristaTypeField } from "./KristaTypeField";
import { ICompositeField } from "./types";
import { FieldTypes } from "../FieldTypes";
import { Priorities } from "../../Priorities";
import { KSDKFormField } from "../../../messaging/form/KSDKFormField";

export class SwitchField extends KristaTypeField<
  SwitchFieldAttributes,
  SwitchValue
> {
  constructor(
    _fieldType: FieldTypes,
    _field: KSDKFormField,
    _parent?: ICompositeField
  ) {
    super(_fieldType, _field, _parent);
  }

  protected static getPriority(field: KSDKFormField): Priorities {
    if (field.fieldType === FieldTypes.SWITCH_FIELD) {
      return Priorities.SpecificType;
    }
    return Priorities.NotSupported;
  }

  protected createAttributes(
    _attributes: Map<string, any>
  ): SwitchFieldAttributes {
    return new SwitchFieldAttributes(_attributes);
  }

  protected createKristaValue(rawValue: any): SwitchValue {
    return new SwitchValue(rawValue);
  }
}
