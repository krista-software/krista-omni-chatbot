import { Priorities } from "../../Priorities";
import { AutoCapitalizeFieldAttributes } from "../field-attributes/AutoCapitalizeFieldAttributes";
import { FieldTypes } from "../FieldTypes";
import { ICompositeField } from "./types";
import { TextField } from "./TextField";
import { KSDKFormField } from "../../../messaging/form/KSDKFormField";

export class AutoCapitalizeField extends TextField {
  constructor(
    _fieldType: FieldTypes,
    _field: KSDKFormField,
    _parent?: ICompositeField
  ) {
    super(_fieldType, _field, _parent);
  }

  protected static getPriority(field: KSDKFormField): Priorities {
    switch (field.fieldType) {
      case FieldTypes.PROPER_NOUN_FIELD:
      case FieldTypes.PERSON_FIELD:
      case FieldTypes.STREET_FIELD:
      case FieldTypes.STREET2_FIELD:
      case FieldTypes.CITY_FIELD:
      case FieldTypes.STATE_FIELD:
      case FieldTypes.COUNTRY_FIELD:
        return Priorities.SpecificType;
      default:
        return Priorities.NotSupported;
    }
  }

  protected createAttributes(
    _attributes: Map<string, any>
  ): AutoCapitalizeFieldAttributes {
    return new AutoCapitalizeFieldAttributes(_attributes);
  }
}
