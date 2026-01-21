import { IdentifierFieldAttributes } from "../field-attributes/IdentifierFieldAttributes";
import { IdentifierValue } from "../field-values/IdentifierValue";
import { KristaTypeField } from "./KristaTypeField";
import { ICompositeField } from "./types";
import { FieldTypes } from "../FieldTypes";
import { Priorities } from "../../Priorities";
import { KSDKFormField } from "../../../messaging/form/KSDKFormField";

export class IdentifierField extends KristaTypeField<
  IdentifierFieldAttributes,
  IdentifierValue
> {
  constructor(
    _fieldType: FieldTypes,
    _field: KSDKFormField,
    _parent?: ICompositeField
  ) {
    super(_fieldType, _field, _parent);
  }

  protected static getPriority(field: KSDKFormField): Priorities {
    if (field.fieldType === FieldTypes.IDENTIFIER_FIELD) {
      return Priorities.SpecificType;
    }
    return Priorities.NotSupported;
  }

  protected createAttributes(
    _attributes: Map<string, any>
  ): IdentifierFieldAttributes {
    return new IdentifierFieldAttributes(_attributes);
  }

  protected createKristaValue(rawValue: string): IdentifierValue {
    return new IdentifierValue(rawValue, this.attributes);
  }
}
