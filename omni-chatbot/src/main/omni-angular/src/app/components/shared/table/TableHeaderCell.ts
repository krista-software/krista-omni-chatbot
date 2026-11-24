import { IField } from "@krista/field-types/core";
import { Cell } from "./Cell";
import { ColumnConfig } from "./TableConfig";

export class TableHeaderCell extends Cell {
  title: string = '';
  type: string = '';
  field?: IField;
  config?: ColumnConfig;

  getDisplay(): string {
    return this.title;
  }
}
