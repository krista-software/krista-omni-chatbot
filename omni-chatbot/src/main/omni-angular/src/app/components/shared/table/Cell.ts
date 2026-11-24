export abstract class Cell {
  rowSpan: number = 1;
  colSpan: number = 1;
  abstract getDisplay(): string;
}
