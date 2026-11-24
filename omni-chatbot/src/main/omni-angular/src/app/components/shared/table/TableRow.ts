import { Cell } from "./Cell";

export class TableRow<T extends Cell> {
  private readonly _cells: T[];
  private cellRenderingValue: string[];
  private _uniqueKey?: string;

  constructor(uniqueKey: string, cells: T[]) {
    this._cells = cells;
    this._uniqueKey = uniqueKey;
    this.cellRenderingValue = this.prepareRenderingValue(cells);
  }

  get cells(): T[] {
    return this._cells;
  }

  get uniqueKey() {
    return this._uniqueKey;
  }

  getCell(colIndex: number): Cell {
    return this._cells[colIndex];
  }

  getRenderingValue(): string[] {
    if (!this.cellRenderingValue) {
      this.cellRenderingValue = this.prepareRenderingValue(this._cells);
    }
    return this.cellRenderingValue;
  }

  private prepareRenderingValue(cells: T[]): string[] {
    return [];
  }
}
