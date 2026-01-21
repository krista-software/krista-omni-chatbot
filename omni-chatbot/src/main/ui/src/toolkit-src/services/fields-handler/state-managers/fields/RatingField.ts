import { RatingFieldAttributes } from "../field-attributes/RatingFieldAttributes";
import { RatingValue } from "../field-values/RatingValue";
import { KristaTypeField } from "./KristaTypeField";
import { ICompositeField } from "./types";
import { FieldTypes } from "../FieldTypes";
import { isDefined } from "../../../../common/utils";
import { Priorities } from "../../Priorities";
import { KSDKFormField } from "../../../messaging/form/KSDKFormField";
import { isValidNumberString } from "../../utils/fields";

export class RatingField extends KristaTypeField<
  RatingFieldAttributes,
  RatingValue
> {
  constructor(
    _fieldType: FieldTypes,
    _field: KSDKFormField,
    _parent?: ICompositeField
  ) {
    super(_fieldType, _field, _parent);
  }

  protected static getPriority(field: KSDKFormField): Priorities {
    if (field.fieldType === FieldTypes.RATING_FIELD) {
      return Priorities.SpecificType;
    }
    return Priorities.NotSupported;
  }

  protected createAttributes(
    _attributes: Map<string, any>
  ): RatingFieldAttributes {
    return new RatingFieldAttributes(_attributes);
  }

  protected createKristaValue(rawValue: number): RatingValue {
    if (!isDefined(rawValue) || !isValidNumberString(rawValue)) {
      return new RatingValue();
    }
    try {
      rawValue = Number(rawValue);
    } catch (ex) {
      return new RatingValue();
    }
    return new RatingValue(rawValue);
  }
}
