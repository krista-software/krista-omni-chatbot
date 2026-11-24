import { CollectionViewer, DataSource } from "@angular/cdk/collections";
import { MatSort, Sort } from "@angular/material/sort";
import {IField} from "@krista/field-types/core";
import { KristaValue } from "@krista/field-types/core/value-schema/KristaValue";
import { BehaviorSubject, Observable } from "rxjs";
import { TableHeaderCell } from "./TableHeaderCell";
import { TableRow } from "./TableRow";
import { ValueCell } from "./ValueCell";

export type TableDataModel<C extends ValueCell> = {
  headerRows: TableRow<TableHeaderCell>[];
  footerRows: TableRow<TableHeaderCell>[];
  dataRows: TableRow<C>[];
};

export abstract class TableDataSource<T, V, C extends ValueCell> implements DataSource<TableRow<C>> {
  headersRows: TableRow<TableHeaderCell>[];
  footerRows: TableRow<TableHeaderCell>[];
  dataRows: TableRow<C>[];

  private tableRowObservable: BehaviorSubject<TableRow<C>[]>;
  private _noDataSubject : BehaviorSubject<boolean>;
  private _sort!: MatSort;

  protected constructor(
    protected meta: T,
    protected values: V,
    protected onActionCellClick: (headerCell: TableHeaderCell, rawValue: any) => void,
  ) {
    const table = this.initTable(meta, values);
    this.headersRows = table.headerRows;
    this.footerRows = table.footerRows;
    this.dataRows = table.dataRows;
    this.tableRowObservable = new BehaviorSubject<TableRow<C>[]>(this.dataRows);
    this._noDataSubject = new BehaviorSubject<boolean>(false);
  }

  set sort(sortInstance: MatSort) {
    this._sort = sortInstance;
    this._sort.sortChange.subscribe((sort: Sort) => {
      this.sortData(sort);
    });
  }

  public notifyNoData(){
    this._noDataSubject.next(true);
  }

  public getNoDataAlertObservable(){
    return this._noDataSubject;
  }

  protected abstract initTable(columns: T, values: V): TableDataModel<C>;

  // protected abstract sort(): TableRow<TableValueCell>[];

  connect(collectionViewer: CollectionViewer): Observable<readonly TableRow<C>[]> {
    return this.tableRowObservable.asObservable();
  }

  disconnect(collectionViewer: CollectionViewer): void {
    this.tableRowObservable.complete();
  }

  protected abstract prepareDataRows(values: V): TableRow<C>[];

  public getTableRowObservable() {
    return this.tableRowObservable;
  }

  public addRows(values: V): void {
    this.putRows(this.prepareDataRows(values));
  }

  protected putRows(dataRows: TableRow<C>[]): void {
    // put logic here
    this.updateDataRows(dataRows);
  }

  public resetDataRows() {
    this.tableRowObservable.next([]);
  }

  public updateDataRows(dataRows: TableRow<C>[]): void {
    this.dataRows = dataRows;
    this.tableRowObservable.next(this.dataRows);
  }

  public getTableRowCount() {
    return this.dataRows.length;
  }

  removeRows(rowsToRemove: TableRow<C>[]): void {
    this.updateDataRows(this.dataRows.filter((row) => !rowsToRemove.includes(row)));
  }

  sortData(sort: { active: string; direction: string }) {
    const { active, direction } = sort;

    if (!active || direction === "") {
      return;
    }

    const isAscending = direction === "asc";
    let headerIndex = this.headersRows[0].cells.findIndex((item) => item.title == active);
    this.dataRows.sort((a, b) => {
      const valueA = a.cells[headerIndex].rawValue;
      const valueB = b.cells[headerIndex].rawValue;

      try {
        // compare KristaValue based on the direction
        if (isAscending) {
          return valueA?.compare(valueB) || 1;
        } else {
          return valueB?.compare(valueA) || 1;
        }
      }
      catch (e) {
        return 0; // If compare method isn't found, don't change order
      }
    });
    this.tableRowObservable.next(this.dataRows);
  }

  public  getFormInputbase(x:any){
     return undefined;
  }

  public getCustomCellMeta(Field: IField, kristaValue: KristaValue){
    return undefined;
  }
}
