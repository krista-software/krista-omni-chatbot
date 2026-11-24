import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FormField, FieldTypes } from '../../../models/message.model';
import { BasicFieldConfig, TextFieldConfig } from '../../../models/field-config.model';
import { EntitySelectorFieldConfig } from '../../../models/entity.model';
import { KristaField } from '../../../models/krista-field.model';
import { KristaFieldService } from '../../../services/krista-field.service';
import { getFieldLabel } from '../shared/field-label.utils';

/**
 * ListField component - renders a list/table field with inline editing, add/delete functionality
 * Matches original's ListFieldRenderer implementation
 *
 * A list field contains a single column that can be a simple field or a composite field.
 * Each row in the list represents one item.
 *
 * Features:
 * - Inline cell editing using dynamic-field component
 * - Support for all field types (text, number, date, entity, etc.)
 * - Support for EntityReference fields with multiple columns
 * - Add/Delete row functionality
 * - Read-only mode support
 */
@Component({
  selector: 'app-list-field',
  templateUrl: './list-field.component.html',
  styleUrls: ['./list-field.component.css'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ListFieldComponent implements OnInit, OnChanges {
  @Input() field!: FormField;
  @Input() config: BasicFieldConfig = {
    hasError: false,
    errorMessage: '',
    readOnly: false
  };
  @Input() kristaFields!: Map<string, KristaField>;
  @Input() hasAttemptedSubmit: boolean = false;
  @Input() workspaceId: string = '';
  @Input() clientSessionId: string = '';

  @Output() valueChange = new EventEmitter<any>();
  @Output() blur = new EventEmitter<any>();
  @Output() focus = new EventEmitter<void>();

  rows: any[] = [];
  rowIds: number[] = [];       // Stable unique ID per row for correct trackBy
  private nextRowId = 0;
  columnField: FormField | null = null;

  // Pagination
  currentPage = 1;
  pageSize = 15;
  totalPages = 1;
  entityFieldDefinitions: FormField[] = [];  // For EntityReference fields - stores the entity's field definitions
  multiFieldDefinitions: FormField[] = [];  // For MultiField - stores the sub-field definitions

  // Complex field modal state (for nested List/Table inside list rows)
  complexFieldModalOpen = false;
  complexFieldModalField: FormField | null = null;
  complexFieldModalRowIndex: number = -1;

  constructor(private cdr: ChangeDetectorRef, private kristaFieldService: KristaFieldService, private sanitizer: DomSanitizer) {}

  ngOnInit(): void {
    this.initializeData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['field'] || changes['config']) {
      this.initializeData();
    }
    // When form submission is attempted, remove empty rows from the list
    if (changes['hasAttemptedSubmit'] && this.hasAttemptedSubmit) {
      this.removeEmptyRows();
    }
  }

  private initializeData(): void {
    if (!this.field) {
      return;
    }

    // Get the list field value from field.value or KristaField
    let listValue: any[] = [];
    if (this.field.value !== undefined && this.field.value !== null) {
      listValue = this.field.value;
    } else {
      const kristaField = this.kristaFields?.get(this.field.name);
      if (kristaField && kristaField.value !== undefined && kristaField.value !== null) {
        listValue = kristaField.value;
      }
    }
    this.rows = Array.isArray(listValue) ? listValue : [];
    // Only regenerate rowIds when the row count changed externally (initial load
    // or parent replaced the data). Value-only updates from our own emitValue()
    // keep the same row count, so existing rowIds stay stable.
    if (this.rowIds.length !== this.rows.length) {
      this.rowIds = this.rows.map(() => this.nextRowId++);
    }

    // Get the column definition from field attributeValues
    this.columnField = this.field.attributeValues?.['field'] || null;

    if (!this.columnField) {
      console.warn('ListField: No column field definition found in attributeValues');
    } else {
      // Match original toolkit behavior: use parent field's displayLabel as column name if not provided
      // See ListFieldAttributes.ts line 12: fieldJson["name"] = fieldJson["name"] || label;
      if (!this.columnField.name) {
        this.columnField.name = this.field.displayName || this.field.name;
      }
      if (!this.columnField.displayName) {
        this.columnField.displayName = this.columnField.name;
      }
    }

    // Unwrap doubly-nested entity rows: [[{fields,meta}]] → [{fields,meta}]
    // This can happen when the value comes back from submission with extra array wrapping
    if (this.isEntityReferenceField()) {
      this.rows = this.rows.map((row: any) => {
        if (Array.isArray(row) && row.length > 0 && row[0]?.fields) {
          return row[0];
        }
        return row;
      });
    }

    // For EntityReference fields, extract the entity field definitions for table headers
    this.entityFieldDefinitions = [];
    if (this.isEntityReferenceField()) {
      if (this.columnField?.attributeValues?.['entityDefinition']?.fields) {
        const entityFields = this.columnField.attributeValues['entityDefinition'].fields;
        // Convert object to array if needed
        if (Array.isArray(entityFields)) {
          this.entityFieldDefinitions = entityFields;
        } else {
          this.entityFieldDefinitions = Object.values(entityFields) as FormField[];
        }
      } else if (this.rows.length > 0) {
        // Fallback: derive field definitions from actual row data when entityDefinition is missing
        const firstRow = Array.isArray(this.rows[0]) ? this.rows[0][0] : this.rows[0];
        if (firstRow?.fields && typeof firstRow.fields === 'object') {
          this.entityFieldDefinitions = Object.keys(firstRow.fields)
            .filter(key => key !== 'primaryKey')
            .map(key => ({
              name: key,
              displayName: key,
              fieldType: this.inferFieldType(firstRow.fields[key]),
            } as FormField));
        }
      }
    }

    // For MultiField, extract the sub-field definitions for table headers
    this.multiFieldDefinitions = [];
    if (this.isMultiField() && this.columnField?.attributeValues?.['fields']) {
      const subFields = this.columnField.attributeValues['fields'];
      this.multiFieldDefinitions = Array.isArray(subFields) ? subFields : [];
    }

    this.updatePagination();
  }

  formatRowValue(rowData: any): string {
    if (rowData === null || rowData === undefined) {
      return '';
    }

    // For simple (non-entity) fields, rowData is the raw value
    // For entity fields, rowData is an object with fields
    // No extraction needed anymore since we store raw values

    // Handle different field types
    if (this.columnField) {
      const fieldType = this.columnField.fieldType;

      switch (fieldType) {
        case 'com.krista.fields.Date':
          return rowData ? new Date(rowData).toLocaleDateString() : '';
        case 'com.krista.fields.Time':
          return this.formatTimeValue(rowData);
        case 'com.krista.fields.DateTime':
          return this.formatDateTimeValue(rowData);
        case 'com.krista.fields.DateRange':
        case 'com.krista.fields.DateTimeRange':
          return this.formatDateRangeValue(rowData, fieldType === 'com.krista.fields.DateTimeRange');
        case 'com.krista.fields.Switch':
        case 'com.krista.fields.Boolean':
          return rowData ? 'Yes' : 'No';
        case 'com.krista.fields.Rating':
          return '★'.repeat(rowData || 0);
        case 'com.krista.fields.Phone':
          if (typeof rowData === 'object' && rowData !== null && rowData.nationalNumber !== undefined) {
            return String(rowData.nationalNumber);
          }
          return String(rowData);
        case 'com.krista.fields.Entity':
        case 'com.krista.fields.EntityReference':
          // For entity fields, show the entity name or formatted entity data
          if (typeof rowData === 'object' && rowData !== null) {
            // Check for entityName first
            if (rowData.entityName) {
              return rowData.entityName;
            }
            // Check for textSummary
            if (rowData.textSummary) {
              return rowData.textSummary;
            }
            // Try to extract from fields object
            if (rowData.fields && typeof rowData.fields === 'object') {
              const fieldValues = Object.values(rowData.fields)
                .filter(v => v !== null && v !== undefined && v !== '')
                .map(v => typeof v === 'object' ? JSON.stringify(v) : String(v));
              if (fieldValues.length > 0) {
                return fieldValues.join(', ');
              }
            }
            // Try to extract from meta
            if (rowData.meta && rowData.meta.primaryKey) {
              return `Entity: ${rowData.meta.primaryKey}`;
            }
          }
          break;
        case 'com.krista.fields.MultiField':
        case 'com.krista.fields.Composite':
          // For composite fields, show formatted field values
          if (typeof rowData === 'object' && rowData !== null) {
            const values = Object.values(rowData).filter(v => v !== null && v !== undefined);
            return values.join(', ');
          }
          break;
        default:
          break;
      }
    }

    // Default formatting for objects
    if (typeof rowData === 'object') {
      // Check if it's an entity-like object (has meta, entityType, etc.)
      if (rowData.entityName) {
        return rowData.entityName;
      }
      if (rowData.textSummary) {
        return rowData.textSummary;
      }
      if (rowData.fields && typeof rowData.fields === 'object') {
        const fieldValues = Object.values(rowData.fields)
          .filter(v => v !== null && v !== undefined && v !== '')
          .map(v => typeof v === 'object' ? JSON.stringify(v) : String(v));
        if (fieldValues.length > 0) {
          return fieldValues.join(', ');
        }
      }

      // Try to extract meaningful data from objects
      if (Array.isArray(rowData)) {
        return rowData.join(', ');
      }

      // For generic objects, try to show a readable representation
      const values = Object.values(rowData).filter(v => v !== null && v !== undefined);
      if (values.length > 0) {
        return values.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).join(', ');
      }
      return JSON.stringify(rowData);
    }
    return String(rowData);
  }

  /**
   * Remove empty rows from the list UI and emit updated value
   * Called when form submission is attempted
   */
  private removeEmptyRows(): void {
    const originalLength = this.rows.length;
    const indicesToRemove: number[] = [];

    for (let i = this.rows.length - 1; i >= 0; i--) {
      if (this.isRowEmpty(this.rows[i])) {
        indicesToRemove.push(i);
      }
    }

    if (indicesToRemove.length === 0) {
      return;
    }

    // Remove empty rows and their corresponding rowIds
    for (const idx of indicesToRemove) {
      this.rows.splice(idx, 1);
      this.rowIds.splice(idx, 1);
    }

    this.emitValue();
    this.cdr.markForCheck();
  }

  /**
   * Check if a row is empty (null, undefined, '', or object with all empty values)
   */
  private isRowEmpty(row: any): boolean {
    if (row === null || row === undefined || row === '') {
      return true;
    }
    if (typeof row === 'object' && !Array.isArray(row)) {
      const obj = row.fields || row;
      return Object.values(obj).every(
        (v: any) => v === null || v === undefined || v === ''
      );
    }
    return false;
  }

  onAddRow(): void {
    if (this.config?.readOnly || this.field.readOnly) {
      return;
    }

    // Add a new empty row
    // For MultiField, create an object with empty values for each sub-field
    // For EntityReference, create an object with fields property
    // For simple fields, add null
    if (this.isMultiField()) {
      const emptyRow: any = {};
      this.multiFieldDefinitions.forEach(fieldDef => {
        emptyRow[fieldDef.name] = null;
      });
      this.rows.push(emptyRow);
    } else if (this.isEntityReferenceField()) {
      this.rows.push({ fields: {} });
    } else {
      this.rows.push(null);
    }
    this.rowIds.push(this.nextRowId++);
    this.updatePagination();
    // Navigate to last page so the new row is visible
    this.currentPage = this.totalPages;
    this.emitValue();
  }

  onDeleteRow(index: number): void {
    if (this.config?.readOnly || this.field.readOnly) {
      return;
    }

    // Convert page-relative index to absolute index
    const absoluteIndex = (this.currentPage - 1) * this.pageSize + index;

    // Remove row and its stable ID at the absolute index
    this.rows.splice(absoluteIndex, 1);
    this.rowIds.splice(absoluteIndex, 1);
    this.updatePagination();
    this.emitValue();
  }

  onRowValueChange(rowIndex: number, value: any): void {
    // Convert page-relative index to absolute index
    const absoluteIndex = (this.currentPage - 1) * this.pageSize + rowIndex;
    this.rows[absoluteIndex] = value;
    this.emitValue();
  }

  private emitValue(): void {
    this.valueChange.emit(this.rows);
    this.cdr.markForCheck();
  }

  /**
   * Update pagination calculations
   */
  private updatePagination(): void {
    this.totalPages = Math.ceil(this.rows.length / this.pageSize);
    if (this.currentPage > this.totalPages) {
      this.currentPage = Math.max(1, this.totalPages);
    }
  }

  /**
   * Get visible rows for current page
   */
  getVisibleRows(): any[] {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.rows.slice(start, end);
  }

  /**
   * Get visible row IDs for current page (for trackBy)
   */
  getVisibleRowIds(): number[] {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.rowIds.slice(start, end);
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.cdr.markForCheck();
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.cdr.markForCheck();
    }
  }

  isFieldRequired(): boolean {
    if (this.field.required === true) return true;
    if (this.field.options?.['required']?.['value'] === true) return true;
    return false;
  }

  private isColumnRequired(col: FormField): boolean {
    if (col.required === true) return true;
    if (col.options?.['required']?.['value'] === true) return true;
    return false;
  }

  isFieldReadOnly(): boolean {
    return this.config?.readOnly || this.field.readOnly || false;
  }

  /**
   * Check if label should be shown
   * Defaults to true if not specified in config
   */
  shouldShowLabel(): boolean {
    return this.config?.showLabel !== false; // Show by default unless explicitly set to false
  }

  /**
   * Get field label with i18n support
   * Uses shared utility function for consistency across all field types
   */
  getFieldLabel(): string {
    return getFieldLabel(this.field);
  }

  getColumnLabel(): string {
    // For column labels, also check displayLabel from backend i18n
    const columnFieldWithLabel = this.columnField as any;
    return columnFieldWithLabel?.displayLabel || this.columnField?.displayName || this.columnField?.name || 'Value';
  }

  /**
   * Get label for sub-fields (entity fields, multi-field definitions)
   * Supports displayLabel from backend i18n
   */
  getSubFieldLabel(fieldDef: any): string {
    return fieldDef?.displayLabel || fieldDef?.displayName || fieldDef?.name || '';
  }

  getTooltip(): string {
    return this.field.attributeValues?.['toolTip'] || '';
  }

  /**
   * Check if the column field should be rendered using dynamic-field component
   * Only MultiField and Composite need dynamic rendering
   * EntityReference fields in readonly mode should just show text summary
   */
  isCompositeField(): boolean {
    if (!this.columnField) {
      return false;
    }
    const fieldType = this.columnField.fieldType;

    // Only MultiField and Composite need dynamic rendering
    // EntityReference will be handled separately
    const needsSpecialRendering =
      fieldType === 'com.krista.fields.MultiField' ||
      fieldType === 'com.krista.fields.Composite';

    return needsSpecialRendering;
  }

  /**
   * Check if the column field is an EntityReference
   */
  isEntityReferenceField(): boolean {
    // Check column field definition first
    if (this.columnField?.fieldType === 'com.krista.fields.EntityReference') {
      return true;
    }
    // Fallback: detect entity rows by data shape (rows with .fields and .meta properties)
    // This handles cases where columnField is missing but rows contain entity data
    if (this.rows.length > 0) {
      const firstRow = Array.isArray(this.rows[0]) ? this.rows[0][0] : this.rows[0];
      if (firstRow && typeof firstRow === 'object' && firstRow.fields && firstRow.meta) {
        return true;
      }
    }
    return false;
  }

  /**
   * Infer field type from value for fallback entity field definitions
   */
  private inferFieldType(value: any): string {
    if (value === null || value === undefined) return 'com.krista.fields.Text';
    if (typeof value === 'object' && value.street !== undefined) return 'com.krista.fields.Address';
    if (typeof value === 'object' && value.latitude !== undefined) return 'com.krista.fields.Location';
    if (typeof value === 'number') return 'com.krista.fields.Number';
    if (typeof value === 'boolean') return 'com.krista.fields.Switch';
    return 'com.krista.fields.Text';
  }

  /**
   * Build a FormField for the entity-selector-field component in readonly mode.
   * Wraps the list rows as the field value and copies the column's attributeValues
   * (which contain entityDefinition) so entity-selector-field can render the table.
   */
  getEntitySelectorFormField(): FormField {
    return {
      fieldType: 'com.krista.fields.Entity',
      name: this.field.name,
      displayName: ' ',
      value: this.rows,
      readOnly: true,
      attributeValues: this.columnField?.attributeValues || {},
      options: this.columnField?.options || {}
    };
  }

  /**
   * Build config for entity-selector-field in readonly mode
   */
  getEntitySelectorConfig(): EntitySelectorFieldConfig {
    return {
      displayValue: '',
      hasError: false,
      errorMessage: '',
      readOnly: true,
      showLabel: false,
      entitySelectorMeta: {
        isMultiSelect: true,
        entityDefinition: this.columnField?.attributeValues?.['entityDefinition'],
        entityTypeDomain: this.columnField?.attributeValues?.['entityTypeDomain']
      } as any
    };
  }

  /**
   * Check if the column field is a MultiField
   */
  isMultiField(): boolean {
    return this.columnField?.fieldType === 'com.krista.fields.MultiField';
  }

  /**
   * Check if the column field is a RichText field
   */
  isRichTextField(): boolean {
    return this.columnField?.fieldType === 'com.krista.fields.RichText';
  }

  /**
   * Check if a sub-field definition is a RichText field
   */
  isRichTextSubField(fieldDef: FormField): boolean {
    return fieldDef?.fieldType === 'com.krista.fields.RichText';
  }

  /**
   * Sanitize an HTML string for safe rendering via [innerHTML]
   */
  sanitizeHtml(value: any): SafeHtml {
    if (!value) {
      return this.sanitizer.bypassSecurityTrustHtml('—');
    }
    const html = String(value).replace(/\n/g, '<br/>');
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  /**
   * Get the sub-field definitions for MultiField
   */
  getMultiFieldDefinitions(): FormField[] {
    return this.multiFieldDefinitions;
  }

  /**
   * Convert MultiField cell data to a FormField for rendering with dynamic-field component
   */
  getMultiFieldCellAsFormField(rowData: any, fieldDef: FormField, rowIndex: number): FormField {
    // Extract the value for this specific field from the row data
    const cellValue = rowData?.[fieldDef.name];

    // Create a FormField for this cell
    const formField: FormField = {
      fieldType: fieldDef.fieldType,
      name: `${this.field.name}_row_${rowIndex}_${fieldDef.name}`,
      displayName: ' ', // Non-empty to prevent getFieldLabel() fallback to field.name; hidden via CSS
      value: cellValue,
      readOnly: this.isFieldReadOnly(),
      required: fieldDef.required,
      attributeValues: fieldDef.attributeValues ? { ...fieldDef.attributeValues } : undefined,
      options: fieldDef.options ? { ...fieldDef.options } : undefined
    };

    return formField;
  }

  /**
   * Handle value change for MultiField cell
   */
  onMultiFieldCellValueChange(rowIndex: number, fieldName: string, value: any): void {
    if (this.isFieldReadOnly()) {
      return;
    }

    // Convert page-relative index to absolute index
    const absoluteIndex = (this.currentPage - 1) * this.pageSize + rowIndex;

    // Ensure row exists as an object
    if (!this.rows[absoluteIndex] || typeof this.rows[absoluteIndex] !== 'object') {
      this.rows[absoluteIndex] = {};
    }

    // Update the specific field value
    this.rows[absoluteIndex][fieldName] = value;
    this.emitValue();
  }

  /**
   * Get the value for a specific field in a MultiField row
   */
  getMultiFieldValue(rowData: any, fieldDef: FormField): string {
    if (!rowData || typeof rowData !== 'object') {
      return '';
    }

    const value = rowData[fieldDef.name];

    if (value === null || value === undefined) {
      return '';
    }

    // Format based on field type
    switch (fieldDef.fieldType) {
      case 'com.krista.fields.Date':
        return value ? new Date(value).toLocaleDateString() : '';
      case 'com.krista.fields.Time':
        return this.formatTimeValue(value);
      case 'com.krista.fields.DateTime':
        return this.formatDateTimeValue(value);
      case 'com.krista.fields.DateRange':
      case 'com.krista.fields.DateTimeRange':
        return this.formatDateRangeValue(value, fieldDef.fieldType === 'com.krista.fields.DateTimeRange');
      case 'com.krista.fields.Switch':
      case 'com.krista.fields.Boolean':
        return value ? 'Yes' : 'No';
      case 'com.krista.fields.Rating':
        return '★'.repeat(value || 0);
      case 'com.krista.fields.Phone':
        if (typeof value === 'object' && value !== null && value.nationalNumber !== undefined) {
          return String(value.nationalNumber);
        }
        return String(value);
      case 'com.krista.fields.Address':
        if (typeof value === 'object' && value !== null) {
          return [value.street, value.street2, value.city, value.state, value.postalCode, value.country]
            .filter(v => v && String(v).trim())
            .join(', ');
        }
        return String(value);
      case 'com.krista.fields.Location':
        if (typeof value === 'object' && value !== null) {
          if (value.address) return value.address;
          if (value.latitude && value.longitude) return `${value.latitude}, ${value.longitude}`;
        }
        return typeof value === 'string' ? value : '';
      default:
        if (typeof value === 'object' && value !== null) {
          const vals = Object.values(value).filter(v => v && typeof v !== 'object');
          return vals.length > 0 ? vals.join(', ') : '';
        }
        return String(value);
    }
  }

  /**
   * Get entity field definitions for table headers
   */
  getEntityFieldDefinitions(): FormField[] {
    return this.entityFieldDefinitions;
  }

  /**
   * Get CSS class for a column based on its field type.
   * Used to apply appropriate min-width for compact field types like Time, Date, etc.
   */
  getColumnTypeClass(fieldDef: FormField): string {
    const fieldType = fieldDef.fieldType || '';
    switch (fieldType) {
      case 'com.krista.fields.Time':
        return 'col-type-time';
      case 'com.krista.fields.Date':
        return 'col-type-date';
      case 'com.krista.fields.DateTime':
        return 'col-type-datetime';
      case 'com.krista.fields.DateRange':
      case 'com.krista.fields.DateTimeRange':
        return 'col-type-daterange';
      case 'com.krista.fields.Number':
      case 'com.krista.fields.Currency':
      case 'com.krista.fields.Percentage':
        return 'col-type-number';
      default:
        return '';
    }
  }

  /**
   * Get the value of a specific field from an entity row
   */
  getEntityFieldValue(row: any, fieldDef: FormField): string {
    if (!row || !row.fields) {
      return '';
    }

    const value = row.fields[fieldDef.name];

    if (value === null || value === undefined || value === '') {
      return '';
    }

    // Format based on field type
    const fieldType = fieldDef.fieldType;

    switch (fieldType) {
      case 'com.krista.fields.Date':
        return value ? new Date(value).toLocaleDateString() : '';
      case 'com.krista.fields.Time':
        return this.formatTimeValue(value);
      case 'com.krista.fields.DateTime':
        return this.formatDateTimeValue(value);
      case 'com.krista.fields.DateRange':
      case 'com.krista.fields.DateTimeRange':
        return this.formatDateRangeValue(value, fieldType === 'com.krista.fields.DateTimeRange');
      case 'com.krista.fields.Switch':
      case 'com.krista.fields.Boolean':
        return value ? 'Yes' : 'No';
      case 'com.krista.fields.Rating':
        return '★'.repeat(value || 0);
      case 'com.krista.fields.File':
      case 'com.krista.fields.Camera':
        if (Array.isArray(value)) {
          return value.map((f: any) => f.fileName || 'File').join(', ');
        }
        return value?.fileName || 'File';
      case 'com.krista.fields.Phone':
        if (typeof value === 'object' && value !== null && value.nationalNumber !== undefined) {
          return String(value.nationalNumber);
        }
        return String(value);
      case 'com.krista.fields.PickMany':
      case 'com.krista.fields.Checkboxes':
        if (Array.isArray(value)) {
          return value.join(', ');
        }
        return String(value);
      case 'com.krista.fields.Address':
        if (typeof value === 'object' && value !== null) {
          return [value.street, value.street2, value.city, value.state, value.postalCode, value.country]
            .filter(v => v && String(v).trim())
            .join(', ');
        }
        return String(value);
      case 'com.krista.fields.Location':
        if (typeof value === 'object' && value !== null) {
          if (value.address) return value.address;
          if (value.latitude && value.longitude) return `${value.latitude}, ${value.longitude}`;
        }
        return typeof value === 'string' ? value : '';
      default:
        if (Array.isArray(value)) {
          return `[${value.length} items]`;
        }
        if (typeof value === 'object' && value !== null) {
          // Try to show a meaningful summary for unknown object types
          const vals = Object.values(value).filter(v => v && typeof v !== 'object');
          return vals.length > 0 ? vals.join(', ') : '';
        }
        return String(value);
    }
  }

  /**
   * Get HTML-safe display value for an entity cell in readonly mode
   */
  getEntityFieldValueHtml(row: any, fieldDef: FormField): string {
    const text = this.getEntityFieldValue(row, fieldDef);
    return text || '—';
  }

  /**
   * Get HTML-safe display value for a multi-field cell in readonly mode
   */
  getMultiFieldValueHtml(row: any, fieldDef: FormField): string {
    const text = this.getMultiFieldValue(row, fieldDef);
    return text || '—';
  }

  /**
   * Format entity reference value as text summary
   * Extracts simple field values from entity.fields and joins them
   */
  formatEntityReferenceValue(entityValue: any): string {
    if (!entityValue || !entityValue.fields) {
      return '';
    }

    const fields = entityValue.fields;
    const values: string[] = [];

    // Extract simple field values (skip complex objects and arrays)
    for (const [key, value] of Object.entries(fields)) {
      if (key === 'primaryKey') continue;
      if (value === null || value === undefined || value === '') continue;

      // Skip arrays and complex objects
      if (Array.isArray(value)) continue;
      if (typeof value === 'object') continue;

      values.push(String(value));
    }

    // Return first 3 values joined with bullet separator (like KristaClient)
    return values.slice(0, 3).join(' • ');
  }

  /**
   * Format a DateRange or DateTimeRange value for display
   * Matches original's DateRangeField.formatFieldValue() / DateTimeRangeField.formatFieldValue()
   * Original code uses moment format "ll" for date (e.g., "Feb 25, 2026") and "lll" for datetime
   * @param value The date range value object with from/to timestamps
   * @param includeTime Whether to include time in the formatted output (DateTimeRange)
   * @returns Formatted string like "Feb 25, 2026 - Feb 27, 2026"
   */
  private formatDateRangeValue(value: any, includeTime: boolean): string {
    if (!value || typeof value !== 'object') {
      return '';
    }

    const from = value.from;
    const to = value.to;

    if (from === undefined || from === null || to === undefined || to === null) {
      return '';
    }

    const dateOptions: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    };

    if (includeTime) {
      dateOptions.hour = 'numeric';
      dateOptions.minute = '2-digit';
    }

    const startStr = new Date(from).toLocaleDateString('en-US', dateOptions);
    const endStr = new Date(to).toLocaleDateString('en-US', dateOptions);
    return `${startStr} - ${endStr}`;
  }

  /**
   * Format a Time value for display
   * Matches original's TimeField.formatFieldValue() which uses "hh:mm A" format
   * @param value Timestamp number
   * @returns Formatted time string like "02:30 PM"
   */
  private formatTimeValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    return new Date(value).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  /**
   * Format a DateTime value for display
   * Combines date and time formatting
   * @param value Timestamp number
   * @returns Formatted datetime string like "Feb 25, 2026, 02:30 PM"
   */
  private formatDateTimeValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    return new Date(value).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  /**
   * Convert row data to a FormField for rendering with dynamic-field component
   */
  getRowAsFormField(rowData: any, rowIndex: number): FormField {
    if (!this.columnField) {
      // Fallback: create a simple text field
      return {
        name: `row_${rowIndex}`,
        displayName: ' ',
        fieldType: 'com.krista.fields.Text',
        value: rowData,
        readOnly: this.isFieldReadOnly()
      };
    }

    // For simple (non-entity) fields, rowData is the raw value
    // For entity fields, rowData is an object with fields
    const cellValue = rowData;

    // Create a FormField based on the column field definition
    // Make sure to deep copy attributeValues to preserve entity configuration
    const formField: FormField = {
      fieldType: this.columnField.fieldType,
      name: `${this.field.name}_row_${rowIndex}`,
      displayName: ' ', // Non-empty to prevent getFieldLabel() fallback to field.name; hidden via CSS
      value: cellValue,
      readOnly: this.isFieldReadOnly(),
      required: this.columnField.required,
      attributeValues: this.columnField.attributeValues ? { ...this.columnField.attributeValues } : undefined,
      options: this.columnField.options ? { ...this.columnField.options } : undefined
    };

    return formField;
  }

  /**
   * Convert entity cell data to a FormField for rendering with dynamic-field component
   */
  getEntityCellAsFormField(rowData: any, fieldDef: FormField, rowIndex: number): FormField {
    // Extract the value for this specific field from the row data
    const cellValue = rowData?.fields?.[fieldDef.name];

    // Create a FormField for this cell
    const formField: FormField = {
      fieldType: fieldDef.fieldType,
      name: `${this.field.name}_row_${rowIndex}_${fieldDef.name}`,
      displayName: ' ', // Non-empty to prevent getFieldLabel() fallback to field.name; hidden via CSS
      value: cellValue,
      readOnly: this.isFieldReadOnly(),
      required: fieldDef.required,
      attributeValues: fieldDef.attributeValues ? { ...fieldDef.attributeValues } : undefined,
      options: fieldDef.options ? { ...fieldDef.options } : undefined
    };

    return formField;
  }

  /**
   * Handle value change for entity cell
   */
  onEntityCellValueChange(rowIndex: number, fieldName: string, value: any): void {
    if (this.isFieldReadOnly()) {
      return;
    }

    // Convert page-relative index to absolute index
    const absoluteIndex = (this.currentPage - 1) * this.pageSize + rowIndex;

    // Ensure row exists and has fields object
    if (!this.rows[absoluteIndex]) {
      this.rows[absoluteIndex] = { fields: {} };
    }
    if (!this.rows[absoluteIndex].fields) {
      this.rows[absoluteIndex].fields = {};
    }

    // Update the specific field value
    this.rows[absoluteIndex].fields[fieldName] = value;
    this.emitValue();
  }

  /**
   * Get a readonly field config for rendering fields in list rows
   */
  getReadOnlyFieldConfig(): BasicFieldConfig {
    return {
      hasError: false,
      errorMessage: '',
      readOnly: true
    };
  }

  /**
   * Get field config for a cell (respects list field's readonly state)
   * Includes validation error state when hasAttemptedSubmit is true
   */
  getCellFieldConfig(rowIndex: number, fieldDef?: FormField, cellValue?: any): BasicFieldConfig {
    let hasError = false;
    let errorMessage = '';

    if (this.hasAttemptedSubmit) {
      const col = fieldDef || this.columnField;
      const absoluteIndex = (this.currentPage - 1) * this.pageSize + rowIndex;
      const value = cellValue !== undefined ? cellValue : this.rows[absoluteIndex];

      if (col) {
        const isRequired = this.isColumnRequired(col);
        const cellField: FormField = {
          ...col,
          value: value,
          required: isRequired
        };
        const validationResult = this.kristaFieldService.validateField(cellField, value);
        hasError = !validationResult.isValid;
        errorMessage = validationResult.errorMessage || '';
      }
    }

    return {
      hasError,
      errorMessage,
      readOnly: this.isFieldReadOnly(),
      showLabel: false // Hide labels in table cells - column headers show the labels
    };
  }

  /**
   * Get text field config for a cell (respects list field's readonly state)
   * Includes validation error state when hasAttemptedSubmit is true
   */
  getCellTextFieldConfig(rowIndex: number, fieldDef?: FormField, cellValue?: any): TextFieldConfig {
    let hasError = false;
    let errorMessage = '';

    if (this.hasAttemptedSubmit) {
      const col = fieldDef || this.columnField;
      const absoluteIndex = (this.currentPage - 1) * this.pageSize + rowIndex;
      const value = cellValue !== undefined ? cellValue : this.rows[absoluteIndex];

      if (col) {
        const isRequired = this.isColumnRequired(col);
        const cellField: FormField = {
          ...col,
          value: value,
          required: isRequired
        };
        const validationResult = this.kristaFieldService.validateField(cellField, value);
        hasError = !validationResult.isValid;
        errorMessage = validationResult.errorMessage || '';
      }
    }

    return {
      displayValue: undefined as any,
      inputType: 'text',
      hasError,
      errorMessage,
      readOnly: this.isFieldReadOnly(),
      placeholder: 'Enter',
      showLabel: false // Hide labels in table cells - column headers show the labels
    };
  }

  /**
   * TrackBy function using stable row IDs so Angular destroys the correct DOM node on delete
   */
  trackByRowIndex = (index: number, row: any): number => {
    const absoluteIndex = (this.currentPage - 1) * this.pageSize + index;
    return this.rowIds[absoluteIndex] ?? index;
  };

  /**
   * TrackBy function for entity field definitions
   */
  trackByFieldDef(index: number, fieldDef: FormField): string {
    return fieldDef.name;
  }

  // ============================================================================
  // Complex Field Modal Support (List/Table nested inside list rows)
  // ============================================================================

  /**
   * Get validation error for a nested complex field (List/Table) row.
   * Returns the error message string if invalid, or null if valid.
   */
  getNestedComplexFieldError(rowValue: any): string | null {
    if (!this.hasAttemptedSubmit || !this.columnField) {
      return null;
    }

    const isRequired = this.isColumnRequired(this.columnField);
    if (!isRequired) {
      return null;
    }

    // A nested List/Table is empty if value is null/undefined or an empty array
    const isEmpty = !rowValue || (Array.isArray(rowValue) && rowValue.length === 0);
    if (isEmpty) {
      return 'This field is required.';
    }

    return null;
  }

  /**
   * Check if the column field is a nested List or Table that should open in a modal
   */
  isNestedComplexField(): boolean {
    if (!this.columnField) {
      return false;
    }
    return this.columnField.fieldType === FieldTypes.LIST_FIELD ||
           this.columnField.fieldType === FieldTypes.TABLE_FIELD;
  }

  /**
   * Check if a MultiField sub-field is a complex type that should open in a modal
   */
  isComplexSubField(fieldDef: FormField): boolean {
    return fieldDef.fieldType === FieldTypes.LIST_FIELD ||
           fieldDef.fieldType === FieldTypes.TABLE_FIELD ||
           fieldDef.fieldType === 'com.krista.fields.EntityReference';
  }

  // Track which sub-field name the modal is editing (for MultiField cells)
  complexFieldModalSubFieldName: string = '';

  /**
   * Open complex field modal for a list row
   */
  openComplexFieldModal(row: any, rowIndex: number): void {
    const absoluteIndex = (this.currentPage - 1) * this.pageSize + rowIndex;
    this.complexFieldModalRowIndex = absoluteIndex;
    this.complexFieldModalSubFieldName = '';
    this.complexFieldModalField = this.getRowAsFormField(row, rowIndex);
    this.complexFieldModalOpen = true;
    this.cdr.detectChanges();
  }

  /**
   * Open complex field modal for a sub-field cell within an EntityReference row
   */
  openComplexEntitySubFieldModal(row: any, rowIndex: number, fieldDef: FormField): void {
    const absoluteIndex = (this.currentPage - 1) * this.pageSize + rowIndex;
    this.complexFieldModalRowIndex = absoluteIndex;
    this.complexFieldModalSubFieldName = fieldDef.name;
    this.complexFieldModalField = this.getEntityCellAsFormField(row, fieldDef, rowIndex);
    this.complexFieldModalOpen = true;
    this.cdr.detectChanges();
  }

  /**
   * Open complex field modal for a sub-field cell within a MultiField row
   */
  openComplexSubFieldModal(row: any, rowIndex: number, fieldDef: FormField): void {
    const absoluteIndex = (this.currentPage - 1) * this.pageSize + rowIndex;
    this.complexFieldModalRowIndex = absoluteIndex;
    this.complexFieldModalSubFieldName = fieldDef.name;
    this.complexFieldModalField = this.getMultiFieldCellAsFormField(row, fieldDef, rowIndex);
    this.complexFieldModalOpen = true;
    this.cdr.detectChanges();
  }

  /**
   * Close complex field modal
   */
  closeComplexFieldModal(): void {
    this.complexFieldModalOpen = false;
    this.complexFieldModalField = null;
    this.complexFieldModalRowIndex = -1;
    this.complexFieldModalSubFieldName = '';
    this.cdr.detectChanges();
  }

  /**
   * Handle value change from complex field modal
   */
  onComplexFieldValueChange(value: any): void {
    if (this.complexFieldModalRowIndex < 0 || !this.complexFieldModalField) {
      return;
    }

    // Update the modal field's value so reopening reflects the latest state
    this.complexFieldModalField.value = value;

    if (this.complexFieldModalSubFieldName) {
      // Sub-field within MultiField or EntityReference row
      const row = this.rows[this.complexFieldModalRowIndex];
      if (typeof row === 'object' && row !== null) {
        // EntityReference rows store sub-fields under 'fields' key
        if (row.fields && typeof row.fields === 'object') {
          row.fields[this.complexFieldModalSubFieldName] = value;
        } else {
          // MultiField rows store sub-fields at root level
          row[this.complexFieldModalSubFieldName] = value;
        }
      }
    } else {
      // Simple list row: replace entire row value
      this.rows[this.complexFieldModalRowIndex] = value;
    }
    this.emitValue();
  }
}

