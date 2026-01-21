import { FieldTypes } from "../FieldTypes";
import { LocationValue } from "../field-values/LocationValue";
import { LocationFieldAttributes } from "../field-attributes/LocationFieldAttributes";
import { KristaTypeField } from "./KristaTypeField";
import { ICompositeField } from "./types";
import { LocationValueJson } from "../types";
import { Priorities } from "../../Priorities";
import { KSDKFormField } from "../../../messaging/form/KSDKFormField";

export class LocationField extends KristaTypeField<
  LocationFieldAttributes,
  LocationValue
> {
  constructor(
    _fieldType: FieldTypes,
    _field: KSDKFormField,
    _parent?: ICompositeField
  ) {
    super(_fieldType, _field, _parent);
  }

  protected static getPriority(field: KSDKFormField): Priorities {
    if (field.fieldType === FieldTypes.LOCATION_FIELD) {
      return Priorities.SpecificType;
    }
    return Priorities.NotSupported;
  }

  protected createAttributes(
    _attributes: Map<string, any>
  ): LocationFieldAttributes {
    return new LocationFieldAttributes(_attributes);
  }

  protected createKristaValue(rawValue: LocationValueJson): LocationValue {
    return new LocationValue(rawValue);
  }
}
