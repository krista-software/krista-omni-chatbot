import { TableFieldAttributes } from "../field-attributes/TableFieldAttributes";
import { KristaTypeField } from "./KristaTypeField";
import { ICompositeField } from "./types";
import { FieldTypes } from "../FieldTypes";
import { BaseTableField } from "./BaseTableField";
import { Priorities } from "../../Priorities";
import { HeaderRow } from "./table/HeaderRow";
import { GenericObject } from "../types";
import { DataRow } from "./table/DataRow";
import { TableFieldDataRow } from "./table/TableDataRow";
import { TableRowValue } from "../field-values/table/TableRowValue";
import { TableValue } from "../field-values/table/TableValue";
import { FieldsHandlerService } from "../../FieldsHandlerService";
import { HeaderCell } from "./table/HeaderCell";
import { KSDKFormField } from "../../../messaging/form/KSDKFormField";
import { EntitySelectorMeta } from "../../classes/entity/EntitySelectorMeta";
import { KristaFieldAttributes } from "../field-attributes/KristaFieldAttributes";
import { KristaValue } from "../field-values/KristaValue";
import { consoleLog } from "../../../../common/utils";

export class TableField extends BaseTableField<TableFieldAttributes> {
  initDone = false;
  constructor(
    _fieldType: FieldTypes,
    _field: KSDKFormField,
    _parent?: ICompositeField
  ) {
    super(_fieldType, _field, _parent);
    TableField.ensureColumnAlignment(this.headers, this.footers);
  }

  protected static getPriority(field: KSDKFormField): Priorities {
    if (field.fieldType === FieldTypes.TABLE_FIELD) {
      return Priorities.SpecificType;
    }
    return Priorities.NotSupported;
  }

  protected createKristaValue(rawValue: any): TableValue {
    // keep the update process of TableValue in sync with updateFieldValue
    if (!this.columns || !this.headers) {
      consoleLog(
        "%c TableField: createKristaValue: columns or headers undefined",
        "color: red;"
      );
      return new TableValue(undefined);
    }
    consoleLog("9 TableField: createKristaValue: start ", { rawValue });
    if (!rawValue || typeof rawValue !== "object") {
      rawValue = {};
    }
    const headersData = rawValue["headers"] || [];
    const footersData = rawValue["footers"] || [];
    this.setHeadersFootersValue(this.headers, headersData, true);
    if (this.footers) {
      this.setHeadersFootersValue(this.footers, footersData);
    }
    const rowsData: any[] = rawValue["rows"] || [];
    const deletedRowsData: any[] = rawValue["deletedRows"] || [];
    const tableValue = new TableValue(rawValue);
    let fieldStates: KristaTypeField<KristaFieldAttributes, KristaValue>[] = [];
    if (rowsData.length > 0 || deletedRowsData.length > 0) {
      consoleLog("6 TableField: creating fieldStates for columns: start");
      fieldStates = this.columns.map((subfield) => {
        return FieldsHandlerService.getFieldStateManager(subfield, this);
      });
      consoleLog("6 TableField: creating fieldStates for columns: done");
    }
    rowsData.forEach((rowData: any) => {
      const rowValue = new TableRowValue(
        this.attributes.tableMeta.entityFieldId,
        rowData[this.attributes.getPrimaryKeyId()]
      );
      fieldStates.forEach((subfield) => {
        let subFieldValue = KristaTypeField.createFieldValue(
          subfield,
          rowData[subfield.fieldId]
        );
        rowValue.setFieldValue(subfield.fieldId, subFieldValue);
      });
      tableValue.addRow(rowValue);
    });
    deletedRowsData.forEach((rowData: any) => {
      const rowValue = new TableRowValue(
        this.attributes.tableMeta.entityFieldId,
        rowData[this.attributes.getPrimaryKeyId()]
      );
      fieldStates.forEach((subfield) => {
        let subFieldValue = KristaTypeField.createFieldValue(
          subfield,
          rowData[subfield.fieldId]
        );
        rowValue.setFieldValue(subfield.fieldId, subFieldValue);
      });
      tableValue.addDeletedRow(rowValue);
    });
    tableValue.setHeaders(this.headers);
    tableValue.setFooters(this.footers);
    consoleLog(
      "9 TableField: createKristaValue: done",
      tableValue.toResponse()
    );
    return tableValue;
  }

  protected createHeaders(rowId: string): HeaderRow[] {
    const headers = this.attributes.tableMeta.headers || [];
    consoleLog({ headers });
    return headers.map((header, index) => {
      const headerRow = new HeaderRow(
        rowId,
        header,
        index !== headers.length - 1
      );
      headerRow.displayAsLabel = index === headers.length - 1;
      return headerRow;
    });
  }

  protected createFooters(rowId: string): HeaderRow[] | undefined {
    const footers = this.attributes.tableMeta.footers || [];
    consoleLog({ footers });
    return footers.map((footer) => new HeaderRow(rowId, footer, true));
  }

  protected createAttributes(
    _attributes: Map<string, any>
  ): TableFieldAttributes {
    return new TableFieldAttributes(_attributes, this.readOnly);
  }

  get entitySelectorMeta(): EntitySelectorMeta | undefined {
    return this.attributes.tableMeta.entitySelectorMeta;
  }

  setValue(newValue: any) {
    if (!newValue || typeof newValue !== "object") {
      newValue = {};
    }
    this.initDone = true;
    const headersData = newValue["headers"] || [];
    const footersData = newValue["footers"] || [];
    consoleLog("14: TableField: setHeadersFootersValue: start");
    this.setHeadersFootersValue(this.headers, headersData, true);
    if (this.footers) {
      this.setHeadersFootersValue(this.footers, footersData);
    }
    consoleLog("14: TableField: setHeadersFootersValue: done");
    let dataRowsJson = newValue["rows"] || [];
    let deletedDataRowsJson = newValue["deletedRows"] || [];
    const dataRows: DataRow[] = [];
    const deletedDataRows: DataRow[] = [];
    dataRowsJson.forEach((rowData: GenericObject) => {
      let newRow: DataRow | null = null;
      newRow = new TableFieldDataRow(
        BaseTableField.nextRowId(),
        this.columns,
        this.attributes.getPrimaryKeyId(),
        rowData,
        this
      );
      if (newRow) {
        dataRows.push(newRow);
      }
    });
    deletedDataRowsJson.forEach((rowData: GenericObject) => {
      let newRow: DataRow | null = null;
      newRow = new TableFieldDataRow(
        BaseTableField.nextRowId(),
        this.columns,
        this.attributes.getPrimaryKeyId(),
        rowData,
        this
      );
      if (newRow) {
        deletedDataRows.push(newRow);
      }
    });
    this.updateFieldValue(dataRows, deletedDataRows);
    this.setRows(dataRows);
    this.setDeletedRows(deletedDataRows);
  }

  setHeadersFootersValue(
    rows: HeaderRow[],
    values: any[],
    skipLastRow = false
  ) {
    rows.forEach((row, index) => {
      // no need to update the last header row because they are readonly column names.
      if (!skipLastRow || index !== rows.length - 1) {
        row.updateResponse(values[index] || {});
      }
    });
  }

  public validate(): boolean {
    this.validators.validate(this.toResponse());
    let rowValid = true;
    [...this.headers, ...this.getDataRows(), ...(this.footers || [])].forEach(
      (row) => {
        if (!row.displayAsLabel && !row.validate()) {
          rowValid = false;
        }
      }
    );
    this.isChildrenValid = rowValid;
    this.dispatchData(true);
    return this.isValid;
  }

  // To remove entry from deletedRows if that entity is reselected
  private checkAndUpdateDeletedRows(values: { [key: string]: any }[] = []) {
    const deletedEntries: string[] = this.deletedRows.map(
      (dataRow) => dataRow.primaryKey
    );
    const entriesFound: string[] = [];
    values.forEach((val) => {
      if (deletedEntries.includes(val[this.attributes.getPrimaryKeyId()])) {
        entriesFound.push(val[this.attributes.getPrimaryKeyId()]);
      }
    });
    if (entriesFound.length > 0) {
      this.deletedRows = this.deletedRows.filter(
        (dataRow) => !entriesFound.includes(dataRow.primaryKey)
      );
    }
  }

  public addRows(values: { [key: string]: any }[] = []): DataRow[] | null {
    if (values && values.length > 0) {
      this.checkAndUpdateDeletedRows(values);
      const filteredValues = this.filterValues(values);
      if (filteredValues.length > 0) {
        let dataRows: DataRow[] = [];
        consoleLog("18 new TableFieldDataRow start");
        filteredValues.forEach((value: any) => {
          dataRows.push(this.createDataRow(value));
        });
        consoleLog("18 new TableFieldDataRow done");
        if (dataRows.length > 0) {
          this.dataRows = [...this.dataRows, ...dataRows];
        }
        consoleLog("20 addRow updateFieldValue start");
        this.updateFieldValue(this.dataRows, this.deletedRows);
        consoleLog("20 addRow updateFieldValue end");
        return dataRows;
      }
      return null;
    }
    return null;
  }

  public addRow(values?: { [key: string]: any }): DataRow | null {
    if (values) {
      this.checkAndUpdateDeletedRows([values]);
      const filteredValues = this.filterValues([values]);
      if (filteredValues.length === 0) {
        return null;
      }
    }
    consoleLog("18 new TableFieldDataRow start");
    const dataRow: DataRow = this.createDataRow(values);
    consoleLog("18 new TableFieldDataRow done");
    this.dataRows = [...this.dataRows, dataRow];
    consoleLog("20 addRow updateFieldValue start");
    this.updateFieldValue(this.dataRows, this.deletedRows);
    consoleLog("20 addRow updateFieldValue end");
    return dataRow;
  }

  private createDataRow(value?: any) {
    return new TableFieldDataRow(
      BaseTableField.nextRowId(),
      this.columns,
      this.attributes.getPrimaryKeyId(),
      value,
      this
    );
  }

  // to avoid multiple entries of an entity
  private filterValues(
    values: { [key: string]: any }[]
  ): { [key: string]: any }[] {
    const existingEntries: string[] = this.dataRows
      .map((dataRow) => dataRow.primaryKey)
      .filter((key) => !!key);
    return values.filter(
      (entry) =>
        !existingEntries.includes(entry[this.attributes.getPrimaryKeyId()])
    );
  }

  protected updateFieldValue(rows: DataRow[], deletedRows?: DataRow[]): void {
    // keep the update process of TableValue in sync with createKristaValue
    const tableValue = new TableValue(undefined);
    rows.forEach((dataRow) => {
      const rowValue = new TableRowValue(
        this.attributes.tableMeta.entityFieldId,
        dataRow.primaryKey
      );
      dataRow.getFields().forEach((kristaField) => {
        rowValue.setFieldValue(
          kristaField.fieldId,
          kristaField.getKristaValue()
        );
      });
      tableValue.addRow(rowValue);
    });
    if (deletedRows) {
      deletedRows.forEach((dataRow) => {
        const rowValue = new TableRowValue(
          this.attributes.tableMeta.entityFieldId,
          dataRow.primaryKey
        );
        dataRow.getFields().forEach((kristaField) => {
          rowValue.setFieldValue(
            kristaField.fieldId,
            kristaField.getKristaValue()
          );
        });
        tableValue.addDeletedRow(rowValue);
      });
    }
    tableValue.setHeaders(this.headers);
    tableValue.setFooters(this.footers);
    consoleLog(
      "15: TableField: updateFieldValue: start: ",
      tableValue.toResponse()
    );
    this.setInternalValue(tableValue);
    consoleLog(
      "15: TableField: updateFieldValue: done: ",
      tableValue.toResponse()
    );
  }

  private static ensureColumnAlignment(
    headers: HeaderRow[],
    footers?: HeaderRow[]
  ): void {
    const headersLength = headers.length;
    let actualColumns = headers[headersLength - 1].getCellMatrix()[0];
    headers.forEach((th, index) => {
      // excluding the last row
      if (index < headersLength - 1) {
        const rowMatrix = th.getCellMatrix()[0];
        let tempIndex = 0;
        rowMatrix.forEach((col, colIndex) => {
          if (col) {
            col.colSpan = actualColumns[tempIndex]?.colSpan || 1;
          } else {
            const emptyCell = new HeaderCell(null);
            emptyCell.colSpan = actualColumns[tempIndex]?.colSpan || 1;
            rowMatrix[colIndex] = emptyCell;
          }
          tempIndex += rowMatrix[colIndex]?.colSpan || 1;
        });
      }
    });
    if (footers) {
      footers.forEach((th) => {
        const rowMatrix = th.getCellMatrix()[0];
        let tempIndex = 0;
        rowMatrix.forEach((col, colIndex) => {
          if (col) {
            col.colSpan = actualColumns[tempIndex]?.colSpan || 1;
          } else {
            const emptyCell = new HeaderCell(null);
            emptyCell.colSpan = actualColumns[tempIndex]?.colSpan || 1;
            rowMatrix[colIndex] = emptyCell;
          }
          tempIndex += rowMatrix[colIndex]?.colSpan || 1;
        });
      });
    }
  }
}
