import { Cell } from "./types";
import { KristaFieldAttributes } from "../../field-attributes";
import { KristaValue } from "../../field-values";
import { KristaTypeField } from "../KristaTypeField";

export class HeaderCell implements Cell {
  public colSpan = 1;
  public rowSpan = 1;

  constructor(
    public readonly field: KristaTypeField<
      KristaFieldAttributes,
      KristaValue
    > | null,
    public colMultiplier = 1,
    public readonly parentCell?: HeaderCell
  ) {}

  getDisplayValue(): string {
    return this.field ? this.field.displayLabel : "";
  }

  getTitle(): string {
    return this.field ? this.field.attributes.toolTip : "";
  }
}
