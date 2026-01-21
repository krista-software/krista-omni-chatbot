import { KristaFieldAttributes } from "../../field-attributes/KristaFieldAttributes";
import { ValueJson } from "../../types";
import { KristaValue } from "../../field-values/KristaValue";
import { BaseCompositeField } from "../BaseCompositeField";
import { KristaTypeField } from "../KristaTypeField";
import { DataCell } from "./DataCell";
import { ICompositeField } from "../types";
import { IRow } from "./types";
import { KSDKFormField } from "../../../../messaging/form/KSDKFormField";
import { consoleLog } from "../../../../../common/utils";

export abstract class DataRow implements IRow<DataCell>, ICompositeField {
  public readonly rowId: string;
  public readonly primaryKey: string;
  protected readonly fields: KristaTypeField<
    KristaFieldAttributes,
    KristaValue
  >[] = [];
  private readonly internalCells: DataCell[][];
  displayAsLabel = false;

  constructor(
    rowId: string,
    originalFields: KSDKFormField[],
    primaryKeyId: string,
    values: any,
    parent?: ICompositeField
  ) {
    this.rowId = rowId;
    this.primaryKey = values ? values[primaryKeyId] : "";
    consoleLog("19 DataRow getFieldStates start");
    this.fields = this.getFieldStates(originalFields, values, parent);
    consoleLog("19 DataRow getFieldStates end");
    this.internalCells = this.prepareCellMatrix(this.fields);
  }

  protected abstract getFieldStates(
    fields: KSDKFormField[],
    values: any,
    parent?: ICompositeField
  ): KristaTypeField<KristaFieldAttributes, KristaValue>[];

  getCellMatrix(): DataCell[][] {
    return this.internalCells;
  }

  getFields(): KristaTypeField<KristaFieldAttributes, KristaValue>[] {
    return this.fields;
  }

  validate(): boolean {
    let isValid = true;
    this.fields.forEach((field) => {
      if (field && !field.validate()) {
        isValid = false;
      }
    });
    return isValid;
  }

  toResponse(): ValueJson {
    const response: ValueJson = {};
    this.fields.forEach((field) => {
      response[field.fieldId] = field.toResponse();
    });
    return response;
  }

  recomputeValue /*updatedField: KristaTypeField<KristaFieldAttributes, KristaValue>,
    prevValue: KristaValue,
    newValue: KristaValue*/() {}

  private prepareCellMatrix(
    fields: KristaTypeField<KristaFieldAttributes, KristaValue>[]
  ): DataCell[][] {
    const matrix: DataCell[][] = [];
    matrix.push(this.prepareFlatCellArray(fields));
    return matrix;
  }

  private prepareFlatCellArray(
    fields: KristaTypeField<KristaFieldAttributes, KristaValue>[]
  ): DataCell[] {
    const cellArray: DataCell[] = [];
    fields.forEach((field) => {
      field.isInsideTable = true;
      if (field instanceof BaseCompositeField) {
        const subfields = field.getSubFields();
        if (subfields.length > 0) {
          cellArray.push(...this.prepareFlatCellArray(subfields));
        } else {
          cellArray.push(new DataCell(null));
        }
      } else {
        cellArray.push(new DataCell(field));
      }
    });
    return cellArray;
  }
}
