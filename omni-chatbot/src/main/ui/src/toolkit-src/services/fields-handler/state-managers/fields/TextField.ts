import { TextFieldAttributes } from "../field-attributes/TextFieldAttributes";
import { TextValue } from "../field-values/TextValue";
import { KristaTypeField } from "./KristaTypeField";
import { ICompositeField } from "./types";
import { FieldTypes } from "../FieldTypes";
import { Priorities } from "../../Priorities";
import { KSDKFormField } from "../../../messaging/form/KSDKFormField";
import { KristaFieldValueResolver } from "../../web-components/KristaFieldValueResolver";

export class TextField extends KristaTypeField<TextFieldAttributes, TextValue> {
  constructor(
    _fieldType: FieldTypes,
    _field: KSDKFormField,
    _parent?: ICompositeField
  ) {
    super(_fieldType, _field, _parent);
  }

  protected static getPriority(field: KSDKFormField): Priorities {
    switch (field.fieldType) {
      case FieldTypes.TEXT_FIELD:
      case FieldTypes.LABEL:
      case FieldTypes.POSTAL_CODE_FIELD:
        return Priorities.SpecificType;
      default:
        return Priorities.NotSupported;
    }
  }

  protected createAttributes(
    _attributes: Map<string, any>
  ): TextFieldAttributes {
    return new TextFieldAttributes(_attributes);
  }

  protected createKristaValue(rawValue: string): TextValue {
    if (!rawValue) {
      return new TextValue(rawValue || "");
    }
    return new TextValue(
      KristaFieldValueResolver.escapeNestedKristaField(rawValue),
      this.attributes
    );
  }
}
