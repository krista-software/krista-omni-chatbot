import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormField, FieldTypes } from '../../../models/message.model';
import { BasicFieldConfig } from '../../../models/field-config.model';
import { KristaField } from '../../../models/krista-field.model';
import { KristaFieldService } from '../../../services/krista-field.service';
import { EntitySelectorMeta, EntitySelectorMetaParser, EntitySearchResult } from '../../../models/entity.model';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * Header cell for multi-level table headers
 */
interface HeaderCell {
  displayName: string;
  name: string;
  required: boolean;
  colSpan: number;
  rowSpan: number;
  field?: FormField;
}

/**
 * A parsed data row for header/footer aggregate rows.
 * Each cell is a FormField with its value populated from the table value.
 */
interface AggregateRow {
  cells: (FormField | null)[];
}

/**
 * TableField component - renders a table field with multiple columns and rows
 * Matches kristaclient's form-table-field implementation
 *
 * A table field contains multiple columns (each can be any field type) and multiple rows.
 * Supports headers, footers, add/delete rows, and entity search.
 *
 * Features:
 * - Multiple columns with different field types
 * - Header and footer rows
 * - Add/Delete row functionality
 * - Entity search integration
 * - Pagination support
 * - Read-only mode support
 * - Inline cell editing
 */
@Component({
  selector: 'app-table-field',
  templateUrl: './table-field.component.html',
  styleUrls: ['./table-field.component.css'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TableFieldComponent implements OnInit, OnChanges {
  // Field data
  @Input() field!: FormField;
  @Input() config: BasicFieldConfig = {
    hasError: false,
    errorMessage: '',
    readOnly: false
  };

  // Krista field integration
  @Input() kristaFields?: Map<string, KristaField>;
  @Input() hasAttemptedSubmit?: boolean;
  @Input() workspaceId?: string;
  @Input() clientSessionId?: string;

  // Event outputs
  @Output() valueChange = new EventEmitter<any>();

  // Table state
  headers: any[] = [];
  footers: any[] = [];
  dataRows: any[] = [];
  deletedRows: any[] = [];
  columns: FormField[] = [];
  originalColumns: FormField[] = []; // Store original columns before flattening
  entityField: FormField | null = null;
  headerRows: any[][] = [];
  footerRows: any[][] = [];
  headerMatrix: HeaderCell[][] = []; // Multi-level header matrix
  headerDataRows: AggregateRow[] = []; // Parsed header aggregate rows (non-label rows)
  footerDataRows: AggregateRow[] = []; // Parsed footer aggregate rows
  selectedRows: Set<string> = new Set();
  showDeleted = false;
  allowAdd = false;
  allowDelete = false;

  // Pagination
  currentPage = 1;
  pageSize = 15;
  totalPages = 1;

  // Entity search state
  entitySearchModalOpen = false;
  entitySelectorMeta: EntitySelectorMeta | undefined;
  allowEntitySearch = false;

  // Complex field modal state
  complexFieldModalOpen = false;
  complexFieldModalField: FormField | null = null;
  complexFieldModalSubFields: FormField[] = [];
  complexFieldModalRow: any = null;

  // Debug: unique instance ID
  private instanceId = Math.random().toString(36).substring(7);

  constructor(
    private cdr: ChangeDetectorRef,
    private kristaFieldService: KristaFieldService
  ) {}

  ngOnInit(): void {
    this.initializeTable();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // When hasAttemptedSubmit changes, trigger change detection to show/hide errors
    if (changes['hasAttemptedSubmit']) {
      this.cdr.markForCheck();
    }
  }

  /**
   * Initialize table from field metadata
   */
  private initializeTable(): void {
    // Get table metadata from field attributes
    const meta = this.field.attributeValues?.['meta'];
    if (!meta) {
      return;
    }

    // Extract only the data columns (NOT the entity field)
    // Entity field is metadata only and should not be displayed
    const metaColumns = meta['columns'] || [];
    const rawColumns = metaColumns.map((col: any) => col.field || col);

    // Store original columns before flattening
    this.originalColumns = rawColumns;

    // Flatten MultiField/Composite columns into sub-columns (like original implementation)
    this.columns = this.flattenColumns(rawColumns);

    // Build header matrix for multi-level headers
    this.headerMatrix = this.buildHeaderMatrix(rawColumns);

    // Store entity field for reference but don't display it
    this.entityField = meta['entity'] || null;

    // Parse entity selector meta for search modal.
    // Gate the search button on entityTypeDomain being present (2.0.16's
    // EntitySelectorMeta.hasEntity): without it the backend cannot resolve the
    // entity on any branch, so showing the button would offer a doomed search.
    if (this.entityField?.attributeValues) {
      this.entitySelectorMeta = EntitySelectorMetaParser.parse(this.entityField.attributeValues);
      this.allowEntitySearch = !!this.entitySelectorMeta?.entityTypeDomain;
    }

    // Extract header and footer rows from metadata
    this.headerRows = meta['headerRows'] || [];
    this.footerRows = meta['footerRows'] || [];

    // Extract permissions
    this.allowAdd = this.field.attributeValues?.['allowAdd'] || false;
    this.allowDelete = this.field.attributeValues?.['allowDelete'] || false;

    // Initialize from field value
    if (this.field.value) {
      this.headers = this.field.value['headers'] || [];
      this.footers = this.field.value['footers'] || [];

      // Normalize rows to internal format
      const rawRows = this.field.value['rows'] || [];
      this.dataRows = rawRows.map((row: any) => this.normalizeRowFromToolkit(row));

      const rawDeletedRows = this.field.value['deletedRows'] || [];
      this.deletedRows = rawDeletedRows.map((row: any) => this.normalizeRowFromToolkit(row));
    }

    // Parse header and footer aggregate rows
    this.headerDataRows = this.parseAggregateRows(this.headerRows, this.headers, true);
    this.footerDataRows = this.parseAggregateRows(this.footerRows, this.footers, false);

    // Calculate pagination
    this.updatePagination();
  }

  /**
   * Flatten columns by expanding MultiField/Composite fields into sub-columns
   * This matches original's DataRow.prepareFlatCellArray() behavior
   */
  private flattenColumns(columns: FormField[]): FormField[] {
    const flattened: FormField[] = [];

    columns.forEach(column => {
      if (this.isCompositeColumnType(column.fieldType)) {
        // Get sub-fields from the composite column (MultiField/Composite/Entity/EntityReference)
        const subFields = this.getComplexFieldSubFields(column);
        if (subFields.length > 0) {
          // Add each sub-field as a separate column
          flattened.push(...subFields);
        } else {
          // No sub-fields, add placeholder
          flattened.push(column);
        }
      } else {
        // Regular field, add as-is
        flattened.push(column);
      }
    });

    return flattened;
  }

  /**
   * Check if a column field type is composite and should be flattened.
   * Matches original's BaseCompositeField check in DataRow.prepareFlatCellArray().
   *
   * ENTITY_SELECTION (com.krista.fields.Entity) is deliberately NOT composite:
   * in the 2.0.16 app, SelectionField extends KristaTypeField (not
   * BaseCompositeField), so an entity-selection column renders as a single cell
   * with the entity search dialog — flattening it into sub-columns produced
   * manual text entry that the backend cannot map to an entity record (no
   * primaryKey). Only EntityReference (ENTITY_FIELD) is flattened, as in 2.0.16.
   */
  private isCompositeColumnType(fieldType: string): boolean {
    return fieldType === FieldTypes.MULTI_FIELD ||
           fieldType === FieldTypes.COMPOSITE_FIELD ||
           fieldType === FieldTypes.ENTITY_FIELD;
  }

  /**
   * Build header matrix for multi-level headers
   * This creates a 2D array where:
   * - Row 0: Parent columns (MultiField/Composite) with colSpan
   * - Row 1: Sub-columns (individual fields)
   *
   * Matches original's HeaderRow.prepareTuples() behavior
   */
  private buildHeaderMatrix(columns: FormField[]): HeaderCell[][] {
    // Check if we have any composite columns (MultiField/Composite/Entity/EntityReference)
    const hasCompositeColumns = columns.some(col => this.isCompositeColumnType(col.fieldType));

    // If no composite columns, return single-row header
    if (!hasCompositeColumns) {
      return [columns.map(col => ({
        displayName: col.displayName || col.name,
        name: col.name,
        required: col.required || col.options?.['required']?.value || false,
        colSpan: 1,
        rowSpan: 1,
        field: col
      }))];
    }

    // Build two-level header matrix
    const row0: HeaderCell[] = []; // Parent columns
    const row1: HeaderCell[] = []; // Sub-columns

    columns.forEach(column => {
      if (this.isCompositeColumnType(column.fieldType)) {
        // Get sub-fields from composite column (MultiField/Composite/Entity/EntityReference)
        const subFields = this.getComplexFieldSubFields(column);

        if (subFields.length > 0) {
          // Add parent header with colSpan = number of sub-fields
          row0.push({
            displayName: column.displayName || column.name,
            name: column.name,
            required: column.required || column.options?.['required']?.value || false,
            colSpan: subFields.length,
            rowSpan: 1,
            field: column
          });

          // Add sub-field headers
          subFields.forEach(subField => {
            // Extract just the sub-field name (after the dot) for display
            // e.g., "Column1.Number1" -> "Number1"
            // The displayName might be "Column1.Number1" or just "Number1"
            let subFieldDisplayName = subField.displayName || subField.name;
            if (subFieldDisplayName.includes('.')) {
              subFieldDisplayName = subFieldDisplayName.split('.').pop()!;
            }

            row1.push({
              displayName: subFieldDisplayName,
              name: subField.name,
              required: subField.required || subField.options?.['required']?.value || false,
              colSpan: 1,
              rowSpan: 1,
              field: subField
            });
          });
        } else {
          // No sub-fields, treat as regular column
          row0.push({
            displayName: column.displayName || column.name,
            name: column.name,
            required: column.required || column.options?.['required']?.value || false,
            colSpan: 1,
            rowSpan: 2, // Span both rows
            field: column
          });
        }
      } else {
        // Regular column - spans both rows
        row0.push({
          displayName: column.displayName || column.name,
          name: column.name,
          required: column.required || column.options?.['required']?.value || false,
          colSpan: 1,
          rowSpan: 2, // Span both rows
          field: column
        });
      }
    });

    return [row0, row1];
  }

  /**
   * Parse header/footer metadata rows into renderable AggregateRow objects.
   *
   * In the original implementation (TableMeta / HeaderRow):
   *  - headerRows from meta is an array of arrays of field definitions
   *  - The LAST headerRow is the column-labels row (handled by headerMatrix)
   *  - Non-last header rows contain aggregate fields (totals, etc.)
   *  - footerRows follow the same structure (all rows are aggregate rows)
   *  - Values come from field.value.headers[] / field.value.footers[]
   *
   * @param metaRows  - headerRows or footerRows from meta (array of arrays of field JSON)
   * @param values    - header or footer values from field.value (array of value objects)
   * @param isHeader  - true for headers (skip last row since it's the column-labels row)
   */
  private parseAggregateRows(metaRows: any[][], values: any[], isHeader: boolean): AggregateRow[] {
    if (!metaRows || metaRows.length === 0) {
      return [];
    }

    const result: AggregateRow[] = [];
    // For headers, skip the last row (it's the column labels row handled by headerMatrix)
    const rowCount = isHeader ? metaRows.length - 1 : metaRows.length;

    for (let i = 0; i < rowCount; i++) {
      const metaRow = metaRows[i];
      if (!metaRow || !Array.isArray(metaRow)) {
        continue;
      }

      const rowValues = values[i] || {};
      const cells: (FormField | null)[] = [];

      metaRow.forEach((fieldDef: any) => {
        if (!fieldDef) {
          cells.push(null);
          return;
        }

        // fieldDef is a field JSON definition (like KSDKFormField)
        // readOnly is false — aggregate cells are editable (matching original where displayAsLabel=false)
        // The template controls readOnly via basicFieldConfig based on isFieldReadOnly()
        const field: FormField = {
          name: fieldDef.name || fieldDef.fieldId || '',
          fieldType: fieldDef.fieldType || 'com.krista.fields.Text',
          displayName: fieldDef.displayName || fieldDef.displayLabel || fieldDef.name || '',
          value: rowValues[fieldDef.name || fieldDef.fieldId] ?? fieldDef.value ?? null,
          required: false,
          readOnly: false,
          attributeValues: fieldDef.attributes || fieldDef.attributeValues || {}
        };

        cells.push(field);
      });

      result.push({ cells });
    }

    return result;
  }

  /**
   * Handle value change in a header or footer aggregate cell.
   * Updates the corresponding value in headers/footers arrays and emits the table value.
   */
  onAggregateValueChange(type: 'header' | 'footer', rowIdx: number, colIdx: number, value: any): void {
    const rows = type === 'header' ? this.headerDataRows : this.footerDataRows;
    const values = type === 'header' ? this.headers : this.footers;

    // Update the cell's field value
    const cell = rows[rowIdx]?.cells[colIdx];
    if (cell) {
      cell.value = value;
    }

    // Update the value object used for submission
    if (!values[rowIdx]) {
      values[rowIdx] = {};
    }
    if (cell) {
      values[rowIdx][cell.name] = value;
    }

    this.emitValue();
    this.cdr.markForCheck();
  }

  // ── Entity Search ──

  openEntitySearchModal(): void {
    if (!this.entitySelectorMeta || this.config.readOnly) return;
    this.entitySearchModalOpen = true;
    this.cdr.markForCheck();
  }

  closeEntitySearchModal(): void {
    this.entitySearchModalOpen = false;
    this.cdr.markForCheck();
  }

  /**
   * Handle entity search selection — converts results to table rows.
   * Matches original's handleEntitySelection: maps each selected entity's fields
   * to a toolkit-format row object, then normalizes it into internal format.
   */
  onEntitySearchSave(selectedEntities: EntitySearchResult[]): void {
    this.closeEntitySearchModal();
    if (!selectedEntities || selectedEntities.length === 0) return;

    const entityFieldId = this.entityField?.name || '';

    selectedEntities.forEach(entity => {
      const primaryKey = entity.value?.meta?.primaryKey || null;

      // Skip duplicates by primary key
      if (primaryKey && this.dataRows.some((row: any) => row.primaryKey === primaryKey)) {
        return;
      }

      // Restore from deleted rows if re-selecting a previously deleted entity
      if (primaryKey) {
        const deletedIdx = this.deletedRows.findIndex((row: any) => row.primaryKey === primaryKey);
        if (deletedIdx >= 0) {
          this.dataRows.push(this.deletedRows.splice(deletedIdx, 1)[0]);
          return;
        }
      }

      // Build toolkit-format row: { columnName: value, entityFieldId: primaryKey }
      // This matches original's handleEntitySelection which does:
      //   selectedEntity.fields.forEach(fs => rowValue[fs.fieldId] = fs.toResponse())
      const rowValue: any = {};

      // Set primary key via entity field id
      if (entityFieldId && primaryKey) {
        rowValue[entityFieldId] = primaryKey;
      }

      // Map entity fields to column values by fieldId
      if (entity.fields && entity.fields.length > 0) {
        entity.fields.forEach((f: FormField) => {
          const fieldId = f.fieldId || f.name;
          rowValue[fieldId] = f.value;
        });
      } else if (entity.value?.fields) {
        // Fallback: use raw entity value fields
        Object.keys(entity.value.fields).forEach(fieldId => {
          rowValue[fieldId] = entity.value.fields[fieldId];
        });
      }

      // Normalize through the same path as initial data loading
      this.dataRows.push(this.normalizeRowFromToolkit(rowValue));
    });

    this.updatePagination();
    this.currentPage = this.totalPages;
    this.emitValue();
    this.cdr.markForCheck();
  }

  /**
   * Normalize row from toolkit format to internal format
   * Toolkit format (nested): { Column1: { Number1: val, Text1: val }, Column2: { ... } }
   * Internal format: { rowId: '...', primaryKey: '...', cells: { Column1: { Number1: val, Text1: val }, Column2: { ... } } }
   */
  private normalizeRowFromToolkit(row: any): any {
    // If already in internal format, return as-is
    if (row.cells && row.rowId) {
      return row;
    }

    // Convert from toolkit format to internal format
    const normalizedRow: any = {
      rowId: this.generateRowId(),
      primaryKey: null,
      cells: {}
    };

    // Extract entity primary key if exists
    if (this.entityField && row[this.entityField.name]) {
      normalizedRow.primaryKey = row[this.entityField.name];
    }

    // Copy all column values to cells
    // Use originalColumns (before flattening) to preserve nested structure
    this.originalColumns.forEach(column => {
      if (row.hasOwnProperty(column.name)) {
        normalizedRow.cells[column.name] = row[column.name];
      } else {
        normalizedRow.cells[column.name] = null;
      }
    });

    return normalizedRow;
  }

  /**
   * Update pagination calculations
   */
  private updatePagination(): void {
    const rows = this.showDeleted ? this.deletedRows : this.dataRows;
    this.totalPages = Math.ceil(rows.length / this.pageSize);
    if (this.currentPage > this.totalPages) {
      this.currentPage = Math.max(1, this.totalPages);
    }
  }

  /**
   * Get visible rows for current page
   */
  getVisibleRows(): any[] {
    const rows = this.showDeleted ? this.deletedRows : this.dataRows;
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    return rows.slice(start, end);
  }

  /**
   * Add a new row
   */
  addRow(): void {
    if (this.config.readOnly || !this.allowAdd) {
      return;
    }

    const newRow: any = {
      rowId: this.generateRowId(),
      primaryKey: null, // New rows don't have a primary key yet
      cells: {}
    };

    // Initialize cells for all columns
    // Handle both simple fields and sub-fields (dotted names)
    this.columns.forEach(column => {
      if (column.name.includes('.')) {
        // Sub-field: create nested structure
        const parts = column.name.split('.');
        const parentFieldName = parts[0];
        const subFieldName = parts[parts.length - 1];

        // Initialize parent object if it doesn't exist
        if (!newRow.cells[parentFieldName]) {
          newRow.cells[parentFieldName] = {};
        }

        // Set sub-field value
        newRow.cells[parentFieldName][subFieldName] = null;
      } else {
        // Simple field
        newRow.cells[column.name] = null;
      }
    });

    this.dataRows.push(newRow);
    this.updatePagination();
    // Navigate to the last page so the new row is visible
    this.currentPage = this.totalPages;
    this.emitValue();
    this.cdr.markForCheck();
  }

  /**
   * Delete selected rows
   */
  deleteSelectedRows(): void {
    if (this.config.readOnly || !this.allowDelete || this.selectedRows.size === 0) {
      return;
    }

    // Move selected rows to deleted rows
    const rowsToDelete = this.dataRows.filter(row => this.selectedRows.has(row.rowId));
    this.deletedRows.push(...rowsToDelete);
    this.dataRows = this.dataRows.filter(row => !this.selectedRows.has(row.rowId));

    this.selectedRows.clear();
    this.updatePagination();
    this.emitValue();
    this.cdr.markForCheck();
  }

  /**
   * Restore selected deleted rows
   */
  restoreSelectedRows(): void {
    if (this.config.readOnly || this.selectedRows.size === 0) {
      return;
    }

    // Move selected rows back to data rows
    const rowsToRestore = this.deletedRows.filter(row => this.selectedRows.has(row.rowId));
    this.dataRows.push(...rowsToRestore);
    this.deletedRows = this.deletedRows.filter(row => !this.selectedRows.has(row.rowId));

    this.selectedRows.clear();

    // Switch back to data rows if no deleted rows remain
    if (this.deletedRows.length === 0) {
      this.showDeleted = false;
    }

    this.updatePagination();
    this.emitValue();
    this.cdr.markForCheck();
  }

  /**
   * Toggle between data rows and deleted rows view
   */
  toggleDeletedView(): void {
    this.showDeleted = !this.showDeleted;
    this.selectedRows.clear();
    this.currentPage = 1;
    this.updatePagination();
    this.cdr.markForCheck();
  }

  /**
   * Toggle row selection
   */
  toggleRowSelection(rowId: string): void {
    if (this.selectedRows.has(rowId)) {
      this.selectedRows.delete(rowId);
    } else {
      this.selectedRows.add(rowId);
    }
    this.cdr.markForCheck();
  }

  /**
   * Check if row is selected
   */
  isRowSelected(rowId: string): boolean {
    return this.selectedRows.has(rowId);
  }

  /**
   * Check if all visible rows are selected
   */
  isAllSelected(): boolean {
    const visibleRows = this.getVisibleRows();
    if (visibleRows.length === 0) {
      return false;
    }
    return visibleRows.every(row => this.selectedRows.has(row.rowId));
  }

  /**
   * Toggle selection of all visible rows
   */
  toggleAllRows(): void {
    const visibleRows = this.getVisibleRows();
    const allSelected = this.isAllSelected();

    if (allSelected) {
      // Deselect all visible rows
      visibleRows.forEach(row => this.selectedRows.delete(row.rowId));
    } else {
      // Select all visible rows
      visibleRows.forEach(row => this.selectedRows.add(row.rowId));
    }
    this.cdr.markForCheck();
  }

  /**
   * Handle cell value change
   */
  onCellValueChange(rowId: string, columnName: string, value: any): void {
    const row = this.dataRows.find(r => r.rowId === rowId);
    if (!row) {
      return;
    }

    // Ensure cells object exists
    if (!row.cells) {
      row.cells = {};
    }

    // Check if this is a sub-field (contains a dot)
    if (columnName.includes('.')) {
      const parts = columnName.split('.');
      const parentFieldName = parts[0];
      const subFieldName = parts.slice(1).join('.');

      // Get or create the parent field value object
      if (!row.cells[parentFieldName] || typeof row.cells[parentFieldName] !== 'object') {
        row.cells[parentFieldName] = {};
      }

      // Update the sub-field value within the parent object
      row.cells[parentFieldName][subFieldName] = value;
    } else {
      // Simple field
      row.cells[columnName] = value;
    }

    this.emitValue();

    // Trigger change detection to update validation errors in table cells
    // This is important when hasAttemptedSubmit is true and user is fixing errors
    this.cdr.markForCheck();
  }

  /**
   * Handle sub-field value change for MultiField/Composite fields in table cells
   * This is called when a sub-field within a MultiField column is edited
   */
  onCellSubFieldValueChange(rowId: string, columnName: string, event: {fieldName: string, value: any}): void {
    const row = this.dataRows.find(r => r.rowId === rowId);
    if (!row) {
      return;
    }

    // Get current cell value (should be an object with sub-field values)
    const currentValue = this.getCellValue(row, columnName) || {};

    // Extract sub-field name from the full field name (e.g., "column1.subfield1" -> "subfield1")
    const subFieldName = event.fieldName.split('.').pop() || event.fieldName;

    // Update the sub-field value
    const updatedValue = {
      ...currentValue,
      [subFieldName]: event.value
    };

    // Update the cell value
    this.onCellValueChange(rowId, columnName, updatedValue);
  }

  /**
   * Handle sub-field blur event
   * Currently a no-op, but can be extended for validation or other blur-related logic
   */
  onSubFieldBlur(event: {fieldName: string, value: any}): void {
    // No-op for now - can be extended if needed
    // This is called when a sub-field loses focus
  }

  /**
   * Get cell value
   * Handles both simple fields and sub-fields (e.g., "parentField.subField")
   */
  getCellValue(row: any, columnName: string): any {
    // Check if this is a sub-field (contains a dot)
    if (columnName.includes('.')) {
      const parts = columnName.split('.');
      const parentFieldName = parts[0];
      const subFieldName = parts[parts.length - 1];

      // Get the parent field value (should be an object)
      const parentValue = row.cells?.[parentFieldName];
      if (parentValue && typeof parentValue === 'object') {
        return parentValue[subFieldName];
      }
      return undefined;
    }

    // Simple field
    return row.cells?.[columnName];
  }

  /**
   * Get field for a cell with its value from the row
   */
  getCellField(row: any, column: FormField): FormField {
    const cellValue = this.getCellValue(row, column.name);

    // Create a new field object with the cell's value
    // Deep copy to avoid mutating the original column definition
    const cellField: FormField = {
      name: column.name,
      fieldType: column.fieldType,
      displayName: column.displayName,
      value: cellValue,
      required: column.required,
      readOnly: this.config.readOnly || column.readOnly || false,
      attributeValues: column.attributeValues ? { ...column.attributeValues } : {},
      options: column.options ? { ...column.options } : {}
    };

    return cellField;
  }

  /**
   * Format phone number value for display
   * Converts phone number object {countryCode, nationalNumber} to formatted string
   */
  formatPhoneNumberValue(value: any): string {
    if (!value || typeof value !== 'object') {
      return '';
    }

    const { countryCode, nationalNumber } = value;

    if (!nationalNumber && nationalNumber !== 0) {
      return '';
    }

    // If there's a country code (and it's not 0), format as international number
    if (countryCode && countryCode !== 0) {
      try {
        const phoneString = `+${countryCode}${nationalNumber}`;
        const phoneNumber = parsePhoneNumberFromString(phoneString);
        return phoneNumber?.formatInternational() || `+${countryCode} ${nationalNumber}`;
      } catch (error) {
        return `+${countryCode} ${nationalNumber}`;
      }
    }

    // No country code or country code is 0, just return the national number
    return `${nationalNumber}`;
  }

  /**
   * Get field configuration for a cell
   * Sets displayValue for special field types that need formatting (like phone numbers)
   * Includes validation error state when hasAttemptedSubmit is true
   */
  getCellFieldConfig(row: any, column: FormField): BasicFieldConfig {
    const cellValue = this.getCellValue(row, column.name);
    let displayValue: string | undefined = undefined;

    // Format phone number values for display
    if (column.fieldType === 'com.krista.fields.Phone' && cellValue) {
      displayValue = this.formatPhoneNumberValue(cellValue);
    }

    // Validate cell value if form submission has been attempted
    // This matches original's behavior where errors show at field level in table cells
    let hasError = false;
    let errorMessage = '';

    // Check if column is required (can be in different places)
    const isRequired = column.required === true || column.options?.['required']?.['value'] === true;

    // Validate ALL fields (required or not) when form submission has been attempted
    // This ensures email, phone, min/max, and other validations are checked
    if (this.hasAttemptedSubmit) {
      // For required List/Table columns, check if the value has actual non-empty rows
      // An array like [null], [{}], [{field: null}] should show "This field is required"
      if (isRequired && (column.fieldType === FieldTypes.LIST_FIELD || column.fieldType === FieldTypes.TABLE_FIELD)) {
        if (!this.hasNonEmptyListRows(cellValue, column)) {
          hasError = true;
          errorMessage = 'This field is required.';
        }
      } else {
        // Create a temporary field object for validation with normalized required flag
        const cellField: FormField = {
          ...column,
          value: cellValue,
          required: isRequired  // Use actual required status
        };

        // Validate using KristaFieldService
        const validationResult = this.kristaFieldService.validateField(cellField, cellValue);
        hasError = !validationResult.isValid;
        errorMessage = validationResult.errorMessage || '';
      }
    }

    return {
      displayValue,
      hasError,
      errorMessage,
      readOnly: this.config.readOnly || this.showDeleted || column.readOnly || false,
      showLabel: false, // Hide labels in table cells since headers already show column names
      hideRequiredIndicator: this.config?.hideRequiredIndicator
    };
  }

  /**
   * Emit table value
   * Transforms rows from { rowId, cells: { col1: val1 } } to { col1: val1, entityId: primaryKey }
   * to match original/toolkit format
   */
  private emitValue(): void {
    // Transform rows to match toolkit format
    const transformedRows = this.dataRows.map(row => this.transformRowForSubmission(row));
    const transformedDeletedRows = this.deletedRows.map(row => this.transformRowForSubmission(row));

    const value = {
      headers: this.headers,
      footers: this.footers,
      rows: transformedRows,
      deletedRows: transformedDeletedRows
    };
    this.valueChange.emit(value);
  }

  /**
   * Transform row from internal format to toolkit format
   * Internal: { rowId: '...', cells: { col1: val1, col2: val2 } }
   * Toolkit: { col1: val1, col2: val2, entityId: primaryKey }
   *
   * Each cell value is processed through kristaFieldService.getKristaValue()
   * to ensure proper formatting (e.g., DateRange adds "type" field, Phone converts to object)
   */
  private transformRowForSubmission(row: any): any {
    const transformedRow: any = {};

    // Process each cell value through the appropriate field's getKristaValue method
    if (row.cells) {
      Object.keys(row.cells).forEach(columnName => {
        const cellValue = row.cells[columnName];

        // Find the column definition for this cell
        const column = this.columns.find(col => col.name === columnName);

        if (column) {
          // Process the cell value through kristaFieldService to ensure proper formatting
          // This matches the original implementation where each cell calls field.toResponse()
          transformedRow[columnName] = this.kristaFieldService.getKristaValue(column, cellValue);
        } else {
          // If column not found, use raw value
          transformedRow[columnName] = cellValue;
        }
      });
    }

    // Add entity field with primary key if entity field exists
    if (this.entityField && row.primaryKey) {
      transformedRow[this.entityField.name] = row.primaryKey;
    }

    return transformedRow;
  }

  /**
   * Generate unique row ID
   */
  private generateRowId(): string {
    return `row_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get tooltip text
   */
  getTooltip(): string {
    return this.field.displayName || this.field.name;
  }

  /**
   * Check if field is required
   */
  isFieldRequired(): boolean {
    return this.field.required || false;
  }

  /**
   * Check if field is readonly
   */
  isFieldReadOnly(): boolean {
    return this.config.readOnly || this.field.readOnly || false;
  }

  /**
   * Track by function for rows
   */
  trackByRowId(index: number, row: any): string {
    return row.rowId;
  }

  /**
   * Track by function for columns
   */
  trackByColumnName(index: number, column: FormField): string {
    return column.name;
  }

  /**
   * Go to next page
   */
  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.cdr.markForCheck();
    }
  }

  /**
   * Go to previous page
   */
  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.cdr.markForCheck();
    }
  }

  /**
   * Check if there are any rows to display
   */
  hasRows(): boolean {
    return this.dataRows.length > 0 || this.deletedRows.length > 0;
  }

  /**
   * Get column headers for display
   * Returns the first header row if available, otherwise uses column names
   */
  getColumnHeaders(): any[] {
    if (this.headerRows.length > 0 && this.headerRows[0].length > 0) {
      return this.headerRows[0];
    }
    // Fallback to column definitions
    return this.columns;
  }

  /**
   * Check if table actions should be shown
   */
  showTableActions(): boolean {
    return !this.config.readOnly && (this.allowAdd || this.allowDelete || this.allowEntitySearch || this.deletedRows.length > 0);
  }

  /**
   * Check if a List/Table cell value has at least one non-empty row
   * Handles: null, undefined, [], [null], [{}], [{subField: null}]
   */
  private hasNonEmptyListRows(value: any, column: FormField): boolean {
    if (!value || !Array.isArray(value) || value.length === 0) {
      return false;
    }

    return value.some((row: any) => {
      if (row === null || row === undefined || row === '') {
        return false;
      }
      if (typeof row === 'object' && !Array.isArray(row)) {
        const obj = row.fields || row;
        return Object.values(obj).some(
          (v: any) => v !== null && v !== undefined && v !== ''
        );
      }
      return true;
    });
  }

  // ============================================================================
  // Complex Field Modal Support (MultiField/Composite/EntityReference in cells)
  // ============================================================================

  /**
   * Check if a column is a tabular field that should open in a modal
   * Only tabular fields (Table, List) show "Open" button in data cells
   * Composite fields (MultiField, Composite) render inline with sub-fields
   */
  isComplexField(column: FormField): boolean {
    // Only Table and List fields should show "Open" button in data cells
    // MultiField and Composite should render inline
    return column.fieldType === FieldTypes.TABLE_FIELD ||
           column.fieldType === FieldTypes.LIST_FIELD;
  }

  /**
   * Open complex field modal for a table cell
   */
  openComplexFieldModal(row: any, column: FormField): void {
    this.complexFieldModalRow = row;
    this.complexFieldModalField = this.getCellField(row, column);

    // Get sub-fields for MultiField/Composite/EntityReference
    this.complexFieldModalSubFields = this.getComplexFieldSubFields(this.complexFieldModalField);

    this.complexFieldModalOpen = true;
    this.cdr.detectChanges();
  }

  /**
   * Close complex field modal
   */
  closeComplexFieldModal(): void {
    this.complexFieldModalOpen = false;
    this.complexFieldModalField = null;
    this.complexFieldModalSubFields = [];
    this.complexFieldModalRow = null;
    this.cdr.detectChanges();
  }

  /**
   * Get sub-fields for complex fields (MultiField/Composite/EntityReference)
   */
  getComplexFieldSubFields(field: FormField): FormField[] {
    // Entity/EntityReference fields
    if (field.fieldType === FieldTypes.ENTITY_FIELD || field.fieldType === FieldTypes.ENTITY_SELECTION) {
      return this.getEntityReferenceSubFields(field);
    }

    // MultiField/Composite fields
    if (field.fieldType === FieldTypes.MULTI_FIELD || field.fieldType === FieldTypes.COMPOSITE_FIELD) {
      return this.getMultiFieldSubFields(field);
    }

    return [];
  }

  /**
   * Get sub-fields for EntityReference fields
   */
  private getEntityReferenceSubFields(field: FormField): FormField[] {
    const entityDefinition = field.attributeValues?.['entityDefinition'];
    if (!entityDefinition || !entityDefinition.fields) {
      return [];
    }

    const entityFieldsObj = entityDefinition.fields;
    const entityValue = field.value || {};
    const entityFieldValues = entityValue.fields || {};

    return Object.keys(entityFieldsObj).map((fieldName: string) => {
      const fieldJson = entityFieldsObj[fieldName];
      const subFieldValue = entityFieldValues[fieldName];
      const subFieldFullName = `${field.name}.${fieldName}`;
      const isRequired = fieldJson.options?.required?.value || false;

      return {
        fieldId: subFieldFullName,
        name: subFieldFullName,
        displayName: fieldJson.name || fieldName,
        fieldType: fieldJson.fieldType,
        value: subFieldValue,
        required: isRequired,
        readOnly: this.config.readOnly || fieldJson.readOnly || false,
        attributeValues: fieldJson.attributeValues || {},
        options: fieldJson.options || {}
      } as FormField;
    });
  }

  /**
   * Get sub-fields for MultiField/Composite fields
   */
  private getMultiFieldSubFields(field: FormField): FormField[] {
    const subFieldsJson = field.attributeValues?.['fields'];
    if (!subFieldsJson || !Array.isArray(subFieldsJson)) {
      return [];
    }

    const parentValue = field.value || {};

    return subFieldsJson.map((subFieldJson: any) => {
      const subFieldValue = parentValue[subFieldJson.name];
      const subFieldFullName = `${field.name}.${subFieldJson.name}`;
      const isRequired = subFieldJson.options?.required?.value || false;

      // Create display name with parent column name
      const parentDisplayName = field.displayName || field.name;
      const subFieldDisplayName = subFieldJson.displayName || subFieldJson.name;
      const fullDisplayName = `${parentDisplayName}.${subFieldDisplayName}`;

      return {
        fieldId: subFieldFullName,
        name: subFieldFullName,
        displayName: fullDisplayName,  // Use full display name for headers
        fieldType: subFieldJson.fieldType,
        value: subFieldValue,
        required: isRequired,
        readOnly: this.config.readOnly || subFieldJson.readOnly || false,
        attributeValues: subFieldJson.attributeValues || {},
        options: subFieldJson.options || {}
      } as FormField;
    });
  }

  /**
   * Handle direct value change from complex field modal (e.g., List field emits its entire array)
   */
  onComplexFieldValueChange(value: any): void {
    if (!this.complexFieldModalRow || !this.complexFieldModalField) {
      return;
    }

    // Update the modal field's value so reopening reflects the latest state
    this.complexFieldModalField.value = value;

    // Persist the value directly to the row cell
    this.onCellValueChange(this.complexFieldModalRow.rowId, this.complexFieldModalField.name, value);
  }

  /**
   * Handle sub-field value change from complex field modal
   */
  onComplexFieldSubFieldChange(event: {fieldName: string, value: any}): void {
    if (!this.complexFieldModalRow || !this.complexFieldModalField) {
      return;
    }

    // Extract the sub-field name (remove parent prefix)
    const subFieldName = event.fieldName.split('.').pop() || event.fieldName;

    // Update the cell value
    const currentValue = this.complexFieldModalField.value || {};
    const updatedValue = {
      ...currentValue,
      [subFieldName]: event.value
    };

    // Update the row's cell value
    this.onCellValueChange(this.complexFieldModalRow.rowId, this.complexFieldModalField.name, updatedValue);
  }

  /**
   * Handle sub-field blur from complex field modal
   */
  onComplexFieldSubFieldBlur(event: {fieldName: string, value: any}): void {
    // Blur events are handled by value change
    // No additional action needed
  }

  /**
   * TrackBy function for header cells
   */
  trackByHeaderCell(index: number, header: HeaderCell): string {
    return header.name;
  }

  /**
   * TrackBy function for index-based tracking
   */
  trackByIndex(index: number): number {
    return index;
  }
}
