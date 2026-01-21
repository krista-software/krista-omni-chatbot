import { AddressFieldAttributes } from "../field-attributes/AddressFieldAttributes";
import { ICompositeField } from "./types";
import { FieldTypes } from "../FieldTypes";
import { MultiField } from "./MultiField";
import { Priorities } from "../../Priorities";
import { KSDKFormField } from "../../../messaging/form/KSDKFormField";

export class AddressField extends MultiField {
  constructor(
    _fieldType: FieldTypes,
    _field: KSDKFormField,
    _parent?: ICompositeField
  ) {
    super(_fieldType, _field, _parent);
  }

  protected createAttributes(
    _attributes: Map<string, any>
  ): AddressFieldAttributes {
    return new AddressFieldAttributes(_attributes);
  }

  protected static getPriority(field: KSDKFormField): Priorities {
    if (field.fieldType === FieldTypes.ADDRESS_FIELD) {
      return Priorities.SpecificType;
    }
    return Priorities.NotSupported;
  }
}
