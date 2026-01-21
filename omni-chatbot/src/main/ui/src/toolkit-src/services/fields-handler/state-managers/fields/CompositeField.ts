import { BaseCompositeField } from "./BaseCompositeField";
import { KristaTypeField } from "./KristaTypeField";
import { ICompositeField } from "./types";
import { CompositeValue } from "../field-values/CompositeValue";
import { CompositeFieldAttributes } from "../field-attributes/CompositeFieldAttributes";
import { FieldTypes } from "../FieldTypes";
import { Priorities } from "../../Priorities";
import { GenericObject } from "../types";
import { KSDKFormField } from "../../../messaging/form/KSDKFormField";

export class CompositeField extends BaseCompositeField<
  CompositeFieldAttributes,
  CompositeValue
> {
  constructor(
    _fieldType: FieldTypes,
    _field: KSDKFormField,
    _parent?: ICompositeField
  ) {
    super(_fieldType, _field, _parent);
  }

  protected static getPriority(field: KSDKFormField): Priorities {
    if (field.fieldType === FieldTypes.COMPOSITE_FIELD) {
      return Priorities.SpecificType;
    }
    return Priorities.NotSupported;
  }

  protected createAttributes(
    _attributes: Map<string, any>
  ): CompositeFieldAttributes {
    return new CompositeFieldAttributes(_attributes);
  }

  protected recreateCompositeValue(): CompositeValue {
    const compositeValue = new CompositeValue();
    this.getSubFields().forEach((subfield) => {
      compositeValue.setFieldValue(subfield.fieldId, subfield.getKristaValue());
    });
    return compositeValue;
  }

  protected getRawSubfieldValue(
    fieldId: string,
    rawValue: GenericObject,
    isComposite = false
  ) {
    if (isComposite) {
      return this.attributes.isDeprecated() ? rawValue : rawValue[fieldId];
    }
    return rawValue[fieldId];
  }

  protected createKristaValue(rawValue: GenericObject = {}): CompositeValue {
    const value = new CompositeValue();
    if (rawValue && Object.keys(rawValue).length > 0) {
      this.getSubFields().forEach((subfield) => {
        const rawSubfieldValue = this.getRawSubfieldValue(
          subfield.fieldId,
          rawValue,
          subfield.isComposite()
        );
        value.setFieldValue(
          subfield.fieldId,
          KristaTypeField.createFieldValue(subfield, rawSubfieldValue)
        );
      });
    }
    return value;
  }
}
