import { EventEmitter } from "@angular/core";
import {PageEvent} from "@angular/material/paginator";
import {Cell} from "./Cell";
import {TableRow} from "./TableRow";

export type ColumnConfig = {
  allowSort?: boolean;
  allowSearch?: boolean;
  minWidth?: number;
  maxWidth?: number;
  resizable?: boolean;
};

type LoadStrategy = "Pagination" | "InfiniteScroll" | "None";
type LoadEvent = { currentPage: number; pageSize: number; fetchPage: number } | { offset: string; pageSize: number; direction: "1" | "-1" };

export interface TableConfig {
  defaultColumnConfig: ColumnConfig;
  loadStrategy: LoadStrategy;
  loadEvent?: EventEmitter<{ loadStrategy: LoadStrategy; event: {} }>;
  allowEditCells?: boolean;
  stickyHeader?: boolean;
  allowRemoveRows?: boolean;
  showCellSelectionData?: boolean;
  selection?: "NONE" | "SINGLE" | "MULTI SELECT";
  onSelection: EventEmitter<Set<String>>;
  onRemoveSelection?: EventEmitter<TableRow<Cell>[]>;
  onPageChange? : EventEmitter<PageEvent>;
  pageSize : number;
  currentPage?: number;
  hideFooter? : boolean;
  disableNextButton?: boolean;
  disablePreviousButton?: boolean;
  readonly?: boolean;
  showBorder : boolean;
}
