import { KristaTypeField } from "./KristaTypeField";
import { ICompositeField } from "./types";
import { ListFieldAttributes } from "../field-attributes/ListFieldAttributes";
import { FieldTypes } from "../FieldTypes";
import { BaseTableField } from "./BaseTableField";
import { Priorities } from "../../Priorities";
import { HeaderRow } from "./table/HeaderRow";
import { ListFieldDataRow } from "./table/ListDataRow";
import { DataRow } from "./table/DataRow";
import { GenericObject } from "../types";
import { TableRowValue } from "../field-values/table/TableRowValue";
import { FieldsHandlerService } from "../../FieldsHandlerService";
import { ListValue } from "../field-values/table/ListValue";
import { KSDKFormField } from "../../../messaging/form/KSDKFormField";
import { KristaFieldAttributes } from "../field-attributes/KristaFieldAttributes";
import { KristaValue } from "../field-values/KristaValue";
import { consoleLog } from "../../../../common/utils";

export class ListField extends BaseTableField<ListFieldAttributes> {
  initDone = false;
  constructor(
    _fieldType: FieldTypes,
    _field: KSDKFormField,
    _parent?: ICompositeField
  ) {
    super(_fieldType, _field, _parent);
  }

  protected static getPriority(field: KSDKFormField): Priorities {
    if (field.fieldType === FieldTypes.LIST_FIELD) {
      return Priorities.SpecificType;
    }
    return Priorities.NotSupported;
  }

  protected createKristaValue(rawValue: any[]): ListValue {
    // keep the update process of ListValue in sync with updateFieldValue
    if (!this.columns) {
      consoleLog(
        "%c ListField: createKristaValue: columns undefined",
        "color: red;"
      );
      return new ListValue(undefined);
    }
    consoleLog("27 ListField: createKristaValue: start ", { rawValue });
    const rowsData: any[] = rawValue || [];
    const listValue = new ListValue(rawValue);
    let fieldStates: KristaTypeField<KristaFieldAttributes, KristaValue>[] = [];
    if (rowsData.length > 0) {
      fieldStates = this.columns.map((subfield) => {
        return FieldsHandlerService.getFieldStateManager(subfield, this);
      });
    }
    rowsData.forEach((rowData: any) => {
      const rowValue = new TableRowValue("");
      fieldStates.forEach((subfield) => {
        let subFieldValue = KristaTypeField.createFieldValue(subfield, rowData);
        rowValue.setFieldValue(subfield.fieldId, subFieldValue);
      });
      listValue.addRow(rowValue);
    });
    consoleLog("27 ListField: createKristaValue: done ", {
      value: listValue.toResponse(),
    });
    return listValue;
  }

  protected createHeaders(rowId: string): HeaderRow[] {
    let columns: KSDKFormField[] = this.getColumns();
    if (columns.length === 1 && columns[0].isComposite()) {
      columns = columns[0].getSubFields();
    }
    const headerRow = new HeaderRow(rowId, columns);
    headerRow.displayAsLabel = true;
    return [headerRow];
  }

  protected createFooters(rowId: string): HeaderRow[] | undefined {
    return undefined;
  }

  protected createAttributes(
    _attributes: Map<string, any>
  ): ListFieldAttributes {
    return new ListFieldAttributes(_attributes, this.readOnly, this.label);
  }

  setValue(newValue: any) {
    this.initDone = true;
    let listRowsRawData = newValue || [];
    const listDataRows: DataRow[] = [];
    listRowsRawData.forEach((rowData: GenericObject) => {
      let newRow: DataRow | null = null;
      newRow = new ListFieldDataRow(
        BaseTableField.nextRowId(),
        this.columns,
        this.attributes.getPrimaryKeyId(),
        rowData,
        this
      );
      if (newRow) {
        listDataRows.push(newRow);
      }
    });
    this.updateFieldValue(listDataRows);
    this.setRows(listDataRows);
  }

  public validate(): boolean {
    this.validators.validate(this.toResponse());
    let rowValid = true;
    this.dataRows.forEach((row) => {
      if (!row.validate()) {
        rowValid = false;
      }
    });
    this.isChildrenValid = rowValid;
    this.dispatchData(true);
    return this.isValid;
  }

  public addRow(values?: any): DataRow | null {
    let dataRow: DataRow | null = null;
    consoleLog("25 new ListFieldDataRow start");
    dataRow = new ListFieldDataRow(
      BaseTableField.nextRowId(),
      this.columns,
      this.attributes.getPrimaryKeyId(),
      values,
      this
    );
    consoleLog("25 new ListFieldDataRow done");

    if (dataRow) {
      this.dataRows = [...this.dataRows, dataRow];
      consoleLog("26 addRow updateFieldValue start");
      this.updateFieldValue(this.dataRows);
      consoleLog("26 addRow updateFieldValue done");
      return dataRow;
    }
    return null;
  }

  protected updateFieldValue(rows: DataRow[]): void {
    // keep the update process of ListValue in sync with createKristaValue
    const listValue = new ListValue(undefined);
    rows.forEach((dataRow) => {
      const rowValue = new TableRowValue("");
      dataRow.getFields().forEach((kristaField) => {
        rowValue.setFieldValue(
          kristaField.fieldId,
          kristaField.getKristaValue()
        );
      });
      listValue.addRow(rowValue);
    });
    consoleLog(
      "15: listField: updateFieldValue: start: ",
      listValue.toResponse()
    );
    this.setInternalValue(listValue);
    consoleLog(
      "15: listField: updateFieldValue: done: ",
      listValue.toResponse()
    );
  }
}
