import { EmailFieldAttributes } from "../field-attributes/EmailFieldAttributes";
import { EmailValue } from "../field-values/EmailValue";
import { KristaTypeField } from "./KristaTypeField";
import { ICompositeField } from "./types";
import { FieldTypes } from "../FieldTypes";
import { Priorities } from "../../Priorities";
import { KSDKFormField } from "../../../messaging/form/KSDKFormField";

export class EmailField extends KristaTypeField<
  EmailFieldAttributes,
  EmailValue
> {
  constructor(
    _fieldType: FieldTypes,
    _field: KSDKFormField,
    _parent?: ICompositeField
  ) {
    super(_fieldType, _field, _parent);
  }

  protected static getPriority(field: KSDKFormField): Priorities {
    if (field.fieldType === FieldTypes.EMAIL_FIELD) {
      return Priorities.SpecificType;
    }
    return Priorities.NotSupported;
  }

  protected createAttributes(
    _attributes: Map<string, any>
  ): EmailFieldAttributes {
    return new EmailFieldAttributes(_attributes);
  }

  protected createKristaValue(rawValue: string): EmailValue {
    return new EmailValue(rawValue);
  }
}
