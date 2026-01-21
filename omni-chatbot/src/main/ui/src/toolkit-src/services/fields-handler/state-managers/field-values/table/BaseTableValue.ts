import { ValueJson } from "../../types";
import { KristaValue } from "../KristaValue";
import { TableRowValue } from "./TableRowValue";

export class BaseTableValue extends KristaValue {
  protected readonly _rows: TableRowValue[] = [];

  constructor(readonly rawValue?: any) {
    super();
  }

  get rows(): TableRowValue[] {
    return this._rows;
  }

  isEmpty(): boolean {
    return false;
  }

  setRow(index: number, row: TableRowValue) {
    if (!this.isValidRowIndex(index)) {
      return;
    }
    this._rows[index] = row;
  }

  addRow(row: TableRowValue) {
    this._rows.push(row);
  }

  getRow(index: number): TableRowValue | undefined {
    if (!this.isValidRowIndex(index)) {
      return undefined;
    }
    return this._rows[index];
  }

  getValue(): any {
    return this.rawValue;
  }

  toResponse(): any {
    const rows: ValueJson[] = [];
    this.rows.forEach((row) => {
      const rowResponse = row.toResponse();
      if (rowResponse) {
        rows.push(rowResponse);
      }
    });
    return rows;
  }

  equals(/*value: KristaValue*/): boolean {
    return false;
  }

  private isValidRowIndex(index: number): boolean {
    if (index >= this._rows.length || index < 0) {
      return false;
    }

    return true;
  }

  toString(): string {
    return "";
  }
}
