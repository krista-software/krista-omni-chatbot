import { v4 as uuidv4 } from "uuid";
import { KristaValue } from "../field-values/KristaValue";
import { KristaTypeField } from "./KristaTypeField";
import { ICompositeField } from "./types";
import { DataRow } from "./table/DataRow";
import { HeaderRow } from "./table/HeaderRow";
import { BaseTableFieldAttributes } from "../field-attributes/BaseTableFieldAttributes";
import { KristaFieldAttributes } from "../field-attributes/KristaFieldAttributes";
import { BaseTableValue } from "../field-values/table/BaseTableValue";
import { FieldTypes } from "../FieldTypes";
import { KSDKFormField } from "../../../messaging/form/KSDKFormField";
import { consoleLog } from "../../../../common/utils";

export abstract class BaseTableField<T extends BaseTableFieldAttributes>
  extends KristaTypeField<T, BaseTableValue>
  implements ICompositeField
{
  protected columns: KSDKFormField[];
  protected readonly headers: HeaderRow[];
  protected readonly footers: HeaderRow[] | undefined;
  protected dataRows: DataRow[] = [];
  protected deletedRows: DataRow[] = [];
  isChildrenValid = true;

  protected constructor(
    _fieldType: FieldTypes,
    _field: KSDKFormField,
    _parent?: ICompositeField
  ) {
    super(_fieldType, _field, _parent);
    consoleLog("5 BaseTableField: create columns, headers, footers start");
    this.columns = this.getColumns();
    consoleLog("7 TableField: createHeaders: start");
    this.headers = this.createHeaders(BaseTableField.nextRowId());
    consoleLog("7 TableField: createHeaders: done");
    consoleLog("8 TableField: createFooters: start");
    this.footers = this.createFooters(BaseTableField.nextRowId());
    consoleLog("8 TableField: createFooters: done");
    this.adjustRowSpansInHeaderMatrix(this.headers[this.headers.length - 1]);
    consoleLog("5 BaseTableField: create columns, headers, footers done");
  }

  protected abstract createHeaders(rowId: string): HeaderRow[];

  protected abstract createFooters(rowId: string): HeaderRow[] | undefined;

  protected abstract updateFieldValue(
    rows: DataRow[],
    deletedRows?: DataRow[]
  ): void;

  private adjustRowSpansInHeaderMatrix(lastHeaderRow: HeaderRow) {
    const matrix = lastHeaderRow.getCellMatrix();
    const lastRow = matrix[matrix.length - 1];
    lastRow.forEach((column, colIndex) => {
      if (!column) {
        for (let rowIndex = matrix.length - 1; rowIndex >= 0; rowIndex -= 1) {
          const cell = matrix[rowIndex][colIndex];
          if (cell) {
            cell.rowSpan = matrix.length - rowIndex;
            break;
          }
        }
      }
    });
  }

  protected getColumns(): KSDKFormField[] {
    return this.attributes.getColumns();
  }

  get isValid(): boolean {
    return this.validators.isValid && this.isChildrenValid;
  }

  recomputeValue(
    updatedField: KristaTypeField<KristaFieldAttributes, KristaValue>,
    prevValue: KristaValue,
    newValue: KristaValue
  ) {
    consoleLog("recomputeValue BaseTableField: start", this.value.toResponse());
    this.getDataRows().forEach((dataRow, rowIndex) => {
      const rowValue = this.value.getRow(rowIndex);
      if (rowValue) {
        dataRow.getFields().forEach((kristaField) => {
          rowValue.setFieldValue(
            kristaField.fieldId,
            kristaField.getKristaValue()
          );
        });
      }
    });
    consoleLog("recomputeValue BaseTableField: end", this.value.toResponse());
    consoleLog("21 setInternalValue after recomputeValue: start");
    this.setInternalValue(this.value);
    consoleLog("21 setInternalValue after recomputeValue: end");
  }

  public isTabular(): boolean {
    return true;
  }

  public setRows(rows: DataRow[]): void {
    this.dataRows = [...rows];
  }

  public setDeletedRows(rows: DataRow[]): void {
    this.deletedRows = [...rows];
  }

  public deleteRows(rowIds: string[], allowSystemDelete?: boolean): void {
    if (allowSystemDelete) {
      const deletedRows = this.dataRows.filter(
        (r) => rowIds.includes(r.rowId) && r.primaryKey
      );
      this.deletedRows.push(...deletedRows);
    }
    this.dataRows = this.dataRows.filter((dr) => !rowIds.includes(dr.rowId));
    this.updateFieldValue(this.dataRows, this.deletedRows);
  }

  restoreDeletedRows(rowIds: string[]) {
    if (this.deletedRows.length > 0) {
      const restoreRows = this.deletedRows.filter((r) =>
        rowIds.includes(r.rowId)
      );
      this.dataRows.push(...restoreRows);
      this.deletedRows = this.deletedRows.filter(
        (r) => !rowIds.includes(r.rowId)
      );
      this.updateFieldValue(this.dataRows, this.deletedRows);
    }
  }

  public getDataRows(): DataRow[] {
    return this.dataRows;
  }

  public getDeletedRows(): DataRow[] {
    return this.deletedRows;
  }

  public getHeaders(): HeaderRow[] {
    return this.headers;
  }

  public getFooters(): HeaderRow[] | undefined {
    return this.footers;
  }

  static nextRowId(): string {
    return uuidv4();
  }
}
