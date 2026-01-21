import { KristaFieldAttributes } from "../../field-attributes/KristaFieldAttributes";
import { KristaValue } from "../../field-values/KristaValue";
import { KristaTypeField } from "../KristaTypeField";
import { Cell } from "./types";

export class DataCell implements Cell {
  colSpan = 1;
  rowSpan = 1;

  constructor(
    readonly field: KristaTypeField<KristaFieldAttributes, KristaValue> | null
  ) {}
}
