import {RichTextFieldAttributes} from "../field-attributes/RichTextFieldAttributes";
import {KristaTypeField} from "./KristaTypeField";
import {ICompositeField} from "./types";
import {FieldTypes} from "../FieldTypes";
import {TextValue} from "../field-values/TextValue";
import {Priorities} from "../../Priorities";
import {KSDKFormField} from "../../../messaging/form/KSDKFormField";

export class RichTextField extends KristaTypeField<
  RichTextFieldAttributes,
  TextValue
> {
  constructor(
    _fieldType: FieldTypes,
    _field: KSDKFormField,
    _parent?: ICompositeField
  ) {
    super(_fieldType, _field, _parent);
  }

  protected static getPriority(field: KSDKFormField): Priorities {
    if (field.fieldType === FieldTypes.RICH_TEXT_FIELD) {
      return Priorities.SpecificType;
    }
    return Priorities.NotSupported;
  }

  protected createAttributes(
    _attributes: Map<string, any>
  ): RichTextFieldAttributes {
    return new RichTextFieldAttributes(_attributes);
  }

  protected createKristaValue(rawValue: string): TextValue {
    return new TextValue(rawValue);
  }
}
