import { EntitySearchFilter } from "../classes/entity/EntitySelectorMeta";
import { FieldTypes } from "../state-managers/FieldTypes";
import { BaseCompositeFieldAttributes } from "../state-managers/field-attributes/BaseCompositeFieldAttributes";
import { BaseTableFieldAttributes } from "../state-managers/field-attributes/BaseTableFieldAttributes";
import { KristaFieldAttributes } from "../state-managers/field-attributes/KristaFieldAttributes";
import { BaseCompositeValue } from "../state-managers/field-values/BaseCompositeValue";
import { KristaValue } from "../state-managers/field-values/KristaValue";
import { BaseCompositeField } from "../state-managers/fields/BaseCompositeField";
import { BaseTableField } from "../state-managers/fields/BaseTableField";
import { KristaTypeField } from "../state-managers/fields/KristaTypeField";

export const getMaskedValue = (value: string, maskChar: string = "•") => {
  let _maskedValue = "";
  if (value) {
    _maskedValue = (value || "")
      .split("")
      .map((char) => (char === "\n" ? char : maskChar))
      .join("");
  }
  return _maskedValue;
};

export function isValidNumberString(val: any) {
  if (typeof val === "string") {
    return !(!`${val}`.trim() || Number.isNaN(Number(`${val}`)));
  }
  return true;
}

export function recursivelySetFieldRedOnlyStatus(
  field: KristaTypeField<KristaFieldAttributes, KristaValue>,
  val: boolean
) {
  field.readOnly = val || field.readOnly;
  if (field.isComposite()) {
    const compositeField = field as BaseCompositeField<
      BaseCompositeFieldAttributes,
      BaseCompositeValue
    >;
    const subfields = compositeField.getSubFields();
    subfields.forEach((subfield) => {
      recursivelySetFieldRedOnlyStatus(subfield, val);
    });
  } else if (field.isTabular()) {
    const tabularField = field as BaseTableField<BaseTableFieldAttributes>;
    const dataRows = tabularField.getDataRows();
    if (field.fieldType === "Table") {
      const headerRows = tabularField.getHeaders();
      const footerRows = tabularField.getFooters();
      [...headerRows, ...(footerRows || [])].forEach((headerRow) => {
        const cellMatrix = headerRow.getCellMatrix();
        cellMatrix.forEach((row) => {
          row.forEach((col) => {
            if (col && col.field) {
              recursivelySetFieldRedOnlyStatus(col.field, val);
            }
          });
        });
      });
    }
    dataRows.forEach((dataRow) => {
      const cellMatrix = dataRow.getCellMatrix();
      cellMatrix.forEach((row) => {
        row.forEach((col) => {
          if (col.field) {
            recursivelySetFieldRedOnlyStatus(col.field, val);
          }
        });
      });
    });
  }
}

export function isDateFilter(selectedFilter?: EntitySearchFilter): boolean {
  if (selectedFilter) {
    return selectedFilter.field.fieldType === FieldTypes.DATE_FIELD;
  }
  return false;
}

export function isDateRangeFilter(
  selectedFilter?: EntitySearchFilter
): boolean {
  if (selectedFilter) {
    return selectedFilter.field.fieldType === FieldTypes.DATE_RANGE_FIELD;
  }
  return false;
}
