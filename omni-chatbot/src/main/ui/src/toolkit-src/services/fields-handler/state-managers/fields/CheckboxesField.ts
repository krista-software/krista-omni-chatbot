import { CheckboxesFieldAttributes } from "../field-attributes/CheckboxesFieldAttributes";
import { CheckboxesValue } from "../field-values/CheckboxesValue";
import { KristaTypeField } from "./KristaTypeField";
import { ICompositeField } from "./types";
import { FieldTypes } from "../FieldTypes";
import { Priorities } from "../../Priorities";
import { KSDKFormField } from "../../../messaging/form/KSDKFormField";

export class CheckboxesField extends KristaTypeField<
  CheckboxesFieldAttributes,
  CheckboxesValue
> {
  constructor(
    _fieldType: FieldTypes,
    _field: KSDKFormField,
    _parent?: ICompositeField
  ) {
    super(_fieldType, _field, _parent);
  }

  protected static getPriority(field: KSDKFormField): Priorities {
    if (field.fieldType === FieldTypes.CHECKBOXES_FIELD) {
      return Priorities.SpecificType;
    }
    return Priorities.NotSupported;
  }

  protected createAttributes(
    _attributes: Map<string, any>
  ): CheckboxesFieldAttributes {
    return new CheckboxesFieldAttributes(_attributes);
  }

  protected createKristaValue(value: string[] | string): CheckboxesValue {
    let values: string[] | undefined = [];
    if (typeof value === "string" || value instanceof String) {
      try {
        values = JSON.parse(value as string);
      } catch (e) {
        return new CheckboxesValue();
      }
    } else {
      values = value && value.length > 0 ? value : undefined;
    }
    return new CheckboxesValue(values);
  }
}
