import { PickOneFieldAttributes } from "../field-attributes/PickOneFieldAttributes";
import { PickOneValue } from "../field-values/PickOneValue";
import { KristaTypeField } from "./KristaTypeField";
import { ICompositeField } from "./types";
import { FieldTypes } from "../FieldTypes";
import { Priorities } from "../../Priorities";
import { KSDKFormField } from "../../../messaging/form/KSDKFormField";

export class PickOneField extends KristaTypeField<
  PickOneFieldAttributes,
  PickOneValue
> {
  constructor(
    _fieldType: FieldTypes,
    _field: KSDKFormField,
    _parent?: ICompositeField
  ) {
    super(_fieldType, _field, _parent);
  }

  protected static getPriority(field: KSDKFormField): Priorities {
    if (field.fieldType === FieldTypes.PICK_ONE_FIELD) {
      return Priorities.SpecificType;
    }
    return Priorities.NotSupported;
  }

  protected createAttributes(
    _attributes: Map<string, any>
  ): PickOneFieldAttributes {
    return new PickOneFieldAttributes(_attributes);
  }

  protected createKristaValue(rawValue: string): PickOneValue {
    return new PickOneValue(rawValue);
  }
}
