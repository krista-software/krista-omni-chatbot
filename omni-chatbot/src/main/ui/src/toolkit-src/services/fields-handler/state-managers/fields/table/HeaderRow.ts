import { KSDKFormField } from "./../../../../messaging/form/KSDKFormField";
import { HeaderCell } from "./HeaderCell";
import { createMatrix } from "./TableUtils";
import { FieldsHandlerService } from "../../../FieldsHandlerService";
import { KristaFieldAttributes } from "../../field-attributes/KristaFieldAttributes";
import { KristaValue } from "../../field-values/KristaValue";
import { KristaTypeField } from "../KristaTypeField";
import { BaseCompositeField } from "../BaseCompositeField";
import { BaseCompositeFieldAttributes } from "../../field-attributes/BaseCompositeFieldAttributes";
import { BaseCompositeValue } from "../../field-values/BaseCompositeValue";
import { IRow, TupleCell } from "./types";
import { GenericObject, fieldVisualWidth } from "../../types";
import { consoleLog } from "../../../../../common/utils";

const columnMultipliers: { [key in fieldVisualWidth]: number } = {
  s: 1,
  m: 1.5,
  l: 2,
};
export class HeaderRow implements IRow<HeaderCell> {
  public readonly rowId: string;
  private readonly fields: (
    | KristaTypeField<KristaFieldAttributes, KristaValue>
    | undefined
  )[] = [];
  private readonly internalCells: (HeaderCell | null)[][];
  displayAsLabel = false;

  constructor(
    rowId: string,
    originalFields: (KSDKFormField | undefined)[],
    doNotFlattenCompositeFields = false
  ) {
    this.rowId = rowId;
    originalFields.forEach((field) => {
      if (field) {
        consoleLog("XX this should be in 7 or 8 - create headers and footers");
        const kristaField = FieldsHandlerService.getFieldStateManager(field);
        kristaField.isInsideTable = true;
        this.fields.push(kristaField);
      } else {
        this.fields.push(undefined);
      }
    });

    if (doNotFlattenCompositeFields) {
      const matrix = createMatrix<HeaderCell | null>(1, this.fields.length);
      this.fields.forEach((field, index) => {
        let cell: HeaderCell | null = null;
        if (field) {
          cell = new HeaderCell(field);
          cell.colMultiplier = columnMultipliers[field.attributes.visualWidth];
          if (isSmallSwitchField(field)) {
            cell.colMultiplier = 0.5;
          }
        }
        matrix[0][index] = cell;
      });
      this.internalCells = matrix;
    } else {
      this.internalCells = this.prepareCellMatrix(this.fields);
    }
  }

  getCellMatrix(): (HeaderCell | null)[][] {
    return this.internalCells;
  }

  get rows(): number {
    return this.internalCells.length;
  }

  get cols(): number {
    if (this.rows > 0) {
      return this.internalCells[0].length;
    }
    return 0;
  }

  validate(): boolean {
    if (this.displayAsLabel) {
      return true;
    }
    let isValid = true;
    this.fields.forEach((field) => {
      if (field && !field.validate()) {
        isValid = false;
      }
    });
    return isValid;
  }

  updateResponse(values: GenericObject) {
    if (values) {
      this.fields.forEach((field) => {
        if (field) {
          field.setValue(values[field.fieldId], false, false);
        }
      });
    }
  }

  toResponse(): JSON {
    const response: any = {};
    this.fields.forEach((field) => {
      if (field) {
        response[field.fieldId] = field.toResponse();
      }
    });
    return response;
  }

  private prepareCellMatrix(
    originalFields: (
      | KristaTypeField<KristaFieldAttributes, KristaValue>
      | undefined
    )[]
  ): HeaderCell[][] {
    const rawTuples = this.prepareTuples(originalFields, 0, 0);
    let rows = 0;
    let cols = 0;
    rawTuples.forEach((tuple) => {
      rows = Math.max(rows, tuple.row);
      cols = Math.max(cols, tuple.col);
    });
    const matrix = createMatrix<HeaderCell>(rows + 1, cols + 1);
    rawTuples.forEach((tuple) => {
      matrix[tuple.row][tuple.col] = tuple.cell;
    });

    return matrix;
  }

  private prepareTuples(
    fields: (KristaTypeField<KristaFieldAttributes, KristaValue> | undefined)[],
    row: number,
    col: number,
    parent?: HeaderCell
  ): TupleCell[] {
    if (parent) {
      // parent span calculated from child span
      // total of child colSpan is parent colSpan
      parent.colSpan = 0;
      parent.colMultiplier = 0;
    }

    let currentColumn = col;
    const rawMatrixCell: TupleCell[] = [];
    fields.forEach((field) => {
      if (field) {
        let colMultiplier = columnMultipliers[field.attributes.visualWidth];
        if (isSmallSwitchField(field)) {
          colMultiplier = 0.5;
        }
        const currentCell = new HeaderCell(field, colMultiplier, parent);
        rawMatrixCell.push({ row: row, col: currentColumn, cell: currentCell });
        if (field.isComposite()) {
          const subfields = (
            field as BaseCompositeField<
              BaseCompositeFieldAttributes,
              BaseCompositeValue
            >
          ).getSubFields();
          if (subfields && subfields.length > 0) {
            rawMatrixCell.push(
              ...this.prepareTuples(
                subfields,
                row + 1,
                currentColumn,
                currentCell
              )
            );
          }
        }
        currentColumn += currentCell.colSpan;
        if (parent) {
          parent.colSpan += currentCell.colSpan;
          parent.colMultiplier += currentCell.colMultiplier;
        }
      } else {
        currentColumn += 1;
      }
    });

    return rawMatrixCell;
  }
}

function isSmallSwitchField(
  field: KristaTypeField<KristaFieldAttributes, KristaValue>
) {
  return field.fieldType === "Switch" && field.attributes.visualWidth === "s";
}
