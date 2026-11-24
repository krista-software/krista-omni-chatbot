import { KristaValue } from "@krista/field-types/core/value-schema/KristaValue";
import { Cell } from "./Cell";

export abstract class ValueCell extends Cell {
  protected constructor(
    readonly rawValue: KristaValue,
    readonly value: string,
  ) {
    super();
  }

  getRawValue(): KristaValue {
    return this.rawValue;
  }
}
