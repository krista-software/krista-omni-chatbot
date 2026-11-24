import { ValueCell } from "./ValueCell";

export class TableActionCell extends ValueCell {
  public onCellClick: Function;
  constructor(rawValue: any, value: string, onCellClick: (headerColumn: any, actionCell: TableActionCell) => void) {
    super(rawValue, value);
    this.onCellClick = onCellClick;
  }

  getDisplay(): string {
    return "";
  }
}
