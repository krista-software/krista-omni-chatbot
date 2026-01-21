import { ValueJson } from "../../types";
import { HeaderCell } from "./HeaderCell";

export interface Cell {
  rowSpan: number;
  colSpan: number;
}

export interface IRow<T extends Cell> {
  readonly rowId: string;

  readonly displayAsLabel: boolean;

  getCellMatrix(): (T | null)[][];

  toResponse(): ValueJson;

  validate(): boolean;
}

export interface TupleCell {
  row: number;
  col: number;
  cell: HeaderCell;
}
