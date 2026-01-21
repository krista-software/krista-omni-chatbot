import { BaseCompositeField } from "./BaseCompositeField";
import { MultiFieldAttributes } from "../field-attributes/MultiFieldAttributes";
import { KristaTypeField } from "./KristaTypeField";
import { ICompositeField } from "./types";
import { CompositeValue } from "../field-values/CompositeValue";
import { FieldTypes } from "../FieldTypes";
import { BaseCompositeValue } from "../field-values/BaseCompositeValue";
import { Priorities } from "../../Priorities";
import { GenericObject } from "../types";
import { KSDKFormField } from "../../../messaging/form/KSDKFormField";
import { consoleLog } from "../../../../common/utils";

export class MultiField extends BaseCompositeField<
  MultiFieldAttributes,
  BaseCompositeValue
> {
  constructor(
    _fieldType: FieldTypes,
    _field: KSDKFormField,
    _parent?: ICompositeField
  ) {
    super(_fieldType, _field, _parent);
  }

  protected static getPriority(field: KSDKFormField): Priorities {
    if (field.fieldType === FieldTypes.MULTI_FIELD) {
      return Priorities.SpecificType;
    }
    return Priorities.NotSupported;
  }

  protected recreateCompositeValue(): CompositeValue {
    const compositeValue = new CompositeValue();
    this.getSubFields().forEach((subfield) => {
      compositeValue.setFieldValue(subfield.fieldId, subfield.getKristaValue());
    });
    return compositeValue;
  }

  protected createKristaValue(rawValue: GenericObject): CompositeValue {
    consoleLog("28 MultiField: createKristaValue: start: ", { rawValue });
    const compositeValue = new CompositeValue();
    if (rawValue && Object.keys(rawValue).length > 0) {
      this.getSubFields().forEach((subfield) => {
        consoleLog("subfield: ", {
          subfield: subfield.fieldId,
          val: rawValue[subfield.fieldId],
        });
        let subFieldValue = KristaTypeField.createFieldValue(
          subfield,
          rawValue[subfield.fieldId]
        );
        compositeValue.setFieldValue(subfield.fieldId, subFieldValue);
      });
    }
    consoleLog("28 MultiField: createKristaValue: done: ", {
      value: compositeValue.toResponse(),
    });
    return compositeValue;
  }

  protected createAttributes(
    _attributes: Map<string, any>
  ): MultiFieldAttributes {
    return new MultiFieldAttributes(_attributes);
  }
}
