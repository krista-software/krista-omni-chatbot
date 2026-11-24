import { KristaValue } from "@krista/field-types/core/value-schema/KristaValue";
import { ValueCell } from "./ValueCell";

export class TableValueCell extends ValueCell {
  constructor(rawValue: KristaValue, value: string) {
    super(rawValue, value);
  }

  getDisplay(): string {
    return this.value;
  }
}
