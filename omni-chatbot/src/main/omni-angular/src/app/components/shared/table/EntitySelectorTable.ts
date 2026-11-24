import { IField } from "@krista/field-types/core";
import { KristaValue } from "@krista/field-types/core/value-schema/KristaValue";
import { TableActionCell } from "./TableActionCell";
import { TableDataModel, TableDataSource } from "./TableDataSource";
import { TableHeaderCell } from "./TableHeaderCell";
import { TableRow } from "./TableRow";
import { TableValueCell } from "./TableValueCell";
import { ValueCell } from "./ValueCell";

/**
 * Simplified EntitySelectorTable for omni-angular
 * This version works with the EntitySearchResult structure from omni-angular
 */
export interface EntityDefinition {
  fields: IField[];
  [key: string]: any;
}

export interface EntityValue {
  fields: { [key: string]: any };
  meta: {
    primaryKey: string;
    entityType: {
      registry: string;
      name: string;
    };
  };
  textSummary?: string;
}

export class EntitySelectorTable extends TableDataSource<EntityDefinition, EntityValue[], ValueCell> {
  private readonly entityDefinition: EntityDefinition;

  constructor(
    entityDefinition: EntityDefinition,
    values: EntityValue[],
    onActionCellClick: (headerColumn: any, rawValue: any) => void
  ) {
    super(entityDefinition, values, onActionCellClick);
    this.entityDefinition = entityDefinition;
  }

  protected initTable(entityDefinition: EntityDefinition, values: EntityValue[]): TableDataModel<ValueCell> {
    const headers = this.prepareHeaderFooterColumn(entityDefinition.fields);
    const dataRows: TableRow<ValueCell>[] = this.prepareInternalDataRows(values, headers, entityDefinition);

    return {
      headerRows: headers,
      footerRows: [],
      dataRows: dataRows,
    };
  }

  private prepareInternalDataRows(
    values: EntityValue[],
    headers: TableRow<TableHeaderCell>[],
    entityDefinition: EntityDefinition
  ): TableRow<ValueCell>[] {
    return values.map((valueRow: EntityValue) => {
      const valueCells = headers[0].cells.map((headerCell) => {
        const fieldName = headerCell.title;
        const fieldValue = valueRow.fields[fieldName];
        
        // Create a simple TableValueCell with the field value
        const displayValue = this.formatFieldValue(fieldValue);
        const cell = new TableValueCell(fieldValue, displayValue);
        
        return cell;
      });

      // Use primaryKey as unique identifier
      const uniqueKey = valueRow.meta?.primaryKey || `row-${Math.random()}`;
      return new TableRow<ValueCell>(uniqueKey, valueCells);
    });
  }

  private prepareHeaderFooterColumn(fields: IField[]): TableRow<TableHeaderCell>[] {
    const headerCells: TableHeaderCell[] = fields.map((field: any) => {
      const headerCell = new TableHeaderCell();
      headerCell.title = field.name || field.getJson?.()?.name || 'Unknown';
      headerCell.type = this.getFieldType(field);
      headerCell.field = field;

      return headerCell;
    });

    return [new TableRow<TableHeaderCell>('header', headerCells)];
  }

  private getFieldType(field: any): string {
    // Try to extract field type from various possible structures
    if (field.type) {
      return field.type;
    }
    if (field.getJson) {
      const json = field.getJson();
      if (json.type) {
        return json.type;
      }
    }
    if (field.fieldType) {
      return field.fieldType;
    }
    return 'Text'; // Default fallback
  }

  private formatFieldValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    // Handle KristaValue objects
    if (value && typeof value === 'object' && value.getDisplay) {
      return value.getDisplay();
    }

    // Handle boolean values (for Switch fields)
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }

    // Handle arrays (for MultiField, List, etc.)
    if (Array.isArray(value)) {
      return value.map(v => this.formatFieldValue(v)).join(', ');
    }

    // Handle objects
    if (typeof value === 'object') {
      // Check if it has a display property
      if (value.display) {
        return value.display;
      }
      // Check if it has a value property
      if (value.value !== undefined) {
        return String(value.value);
      }
      // Try to stringify
      try {
        return JSON.stringify(value);
      } catch (e) {
        return String(value);
      }
    }

    // Default: convert to string
    return String(value);
  }

  protected prepareDataRows(values: EntityValue[]): TableRow<ValueCell>[] {
    const headers = this.prepareHeaderFooterColumn(this.entityDefinition.fields);
    return this.prepareInternalDataRows(values, headers, this.entityDefinition);
  }

  // Override to return undefined for now (not needed for basic functionality)
  public override getFormInputbase(x: any) {
    return undefined;
  }

  // Override to return undefined for now (not needed for basic functionality)
  public override getCustomCellMeta(field: IField, kristaValue: KristaValue) {
    return undefined;
  }
}

