import {FieldValue, KristaTypeField} from "./KristaTypeField";
import {ICompositeField} from "./types";
import {FieldTypes} from "../FieldTypes";
import {Priorities} from "../../Priorities";
import {KSDKFormField} from "../../../messaging";
import {StreamFieldAttributes} from "../field-attributes/StreamFieldAttributes";
import {StreamValue} from "../field-values/StreamValue.ts";
import {StreamValueJson} from "../types.ts";

export class StreamField extends KristaTypeField<StreamFieldAttributes, StreamValue> {
  constructor(_fieldType: FieldTypes,
              _field: KSDKFormField,
              _parent?: ICompositeField) {
    super(_fieldType, _field, _parent);
  }

  protected static getPriority(field: KSDKFormField): Priorities {
    switch (field.fieldType) {
      case FieldTypes.STREAM_FIELD:
        return Priorities.SpecificType;
      default:
        return Priorities.NotSupported;
    }
  }

  setValue(newValue: FieldValue, process = true, recomputeParentValue = true) {
    let value: FieldValue = newValue;
    if(typeof newValue === 'string') {
      value = JSON.parse(newValue);
    }
    super.setValue(value, process, recomputeParentValue);
  }

  protected createAttributes(_attributes: Map<string, any>): StreamFieldAttributes {
    return new StreamFieldAttributes(_attributes);
  }

  protected createKristaValue(rawValue: StreamValueJson): StreamValue {
    return new StreamValue(rawValue);
  }
}
