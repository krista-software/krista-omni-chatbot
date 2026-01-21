import { KristaFieldAttributes } from "../field-attributes/KristaFieldAttributes";
import { KristaValue } from "../field-values/KristaValue";
import { KristaTypeField } from "./KristaTypeField";

export interface ICompositeField {
  // Only composite required to implement this.
  // subfield value change composite value need to compute again.
  recomputeValue(
    updatedField: KristaTypeField<KristaFieldAttributes, KristaValue>,
    prevValue: KristaValue,
    newValue: KristaValue
  ): void;
}
