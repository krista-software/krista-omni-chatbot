import { ParagraphFieldAttributes } from "../field-attributes/ParagraphFieldAttributes";
import { KristaTypeField } from "./KristaTypeField";
import { ICompositeField } from "./types";
import { FieldTypes } from "../FieldTypes";
import { KristaValue } from "../field-values/KristaValue";
import { TextValue } from "../field-values/TextValue";
import { Priorities } from "../../Priorities";
import { KSDKFormField } from "../../../messaging/form/KSDKFormField";
import { KristaFieldValueResolver } from "../../web-components/KristaFieldValueResolver";

export class ParagraphField extends KristaTypeField<
  ParagraphFieldAttributes,
  KristaValue
> {
  constructor(
    _fieldType: FieldTypes,
    _field: KSDKFormField,
    _parent?: ICompositeField
  ) {
    super(_fieldType, _field, _parent);
  }

  protected static getPriority(field: KSDKFormField): Priorities {
    if (field.fieldType === FieldTypes.PARAGRAPH_FIELD) {
      return Priorities.SpecificType;
    }
    return Priorities.NotSupported;
  }

  protected createAttributes(
    _attributes: Map<string, any>
  ): ParagraphFieldAttributes {
    return new ParagraphFieldAttributes(_attributes);
  }

  protected createKristaValue(rawValue: string): TextValue {
    if (!rawValue) {
      return new TextValue(rawValue);
    }
    return new TextValue(
      KristaFieldValueResolver.escapeNestedKristaField(rawValue),
      this.attributes
    );
  }
}
