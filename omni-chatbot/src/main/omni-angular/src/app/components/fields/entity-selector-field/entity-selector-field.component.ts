import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormField } from '../../../models/message.model';
import { EntitySelectorFieldConfig, EntitySearchResult } from '../../../models/entity.model';
import { TableInput } from '../../shared/table/TableInput';
import { TableConfig } from '../../shared/table/TableConfig';
import { EntitySelectorTable, EntityDefinition, EntityValue } from '../../shared/table/EntitySelectorTable';

/**
 * Entity Selector Field Component
 *
 * Displays a text field with a search button that opens a modal
 * for searching and selecting entities.
 *
 * Similar to LocationFieldComponent but for entity selection.
 */
@Component({
  selector: 'app-entity-selector-field',
  templateUrl: './entity-selector-field.component.html',
  styleUrls: ['./entity-selector-field.component.css'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EntitySelectorFieldComponent implements OnInit, OnChanges {
  @Input() field!: FormField;
  @Input() config: EntitySelectorFieldConfig = {
    displayValue: '',
    hasError: false,
    errorMessage: '',
    readOnly: false
  };
  @Input() workspaceId: string = '';
  @Input() clientSessionId: string = '';

  @Output() valueChange = new EventEmitter<any>();

  // Selected entities for table display
  selectedEntities: EntitySearchResult[] = [];
  displayColumns: { name: string; label: string }[] = [];
  tableColumns: string[] = [];

  // Modal state
  isModalOpen: boolean = false;

  // Cell selection for selected entities table
  selectedCellData: string = '';
  selectedCellRow: number = -1;
  selectedCellCol: number = -1;

  // NewTable component input
  tableInput?: TableInput<any, any, any>;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.initializeFromFieldValue();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['field'] && !changes['field'].firstChange) {
      this.initializeFromFieldValue();
    }

    // Re-initialize table when config changes (especially readOnly state)
    // This ensures checkbox and remove button are hidden after form submission
    if (changes['config'] && !changes['config'].firstChange) {
      const prevReadOnly = changes['config'].previousValue?.readOnly;
      const currReadOnly = changes['config'].currentValue?.readOnly;

      // If readOnly state changed and we have selected entities, reinitialize the table
      if (prevReadOnly !== currReadOnly && this.selectedEntities.length > 0) {
        this.initializeNewTable();
        this.cdr.markForCheck();
      }
    }
  }

  /**
   * Initialize selected entities from field value
   */
  private initializeFromFieldValue(): void {
    if (!this.field.value) {
      this.selectedEntities = [];
      return;
    }

    // Convert field value to EntitySearchResult format
    const isMultiSelect = this.config.entitySelectorMeta?.isMultiSelect || false;
    const values = isMultiSelect
      ? (Array.isArray(this.field.value) ? this.field.value : [this.field.value])
      : [this.field.value];

    this.selectedEntities = values.map(value => ({
      value: value,
      textSummary: this.generateTextSummary(value.fields),
      fields: [] // Not needed for display, we use value.fields directly
    }));

    if (this.selectedEntities.length > 0) {
      this.initializeTableColumns();
      this.initializeNewTable();
    }
  }

  /**
   * Generate text summary from field values
   */
  private generateTextSummary(fields: any): string {
    if (!fields) return '';

    const values: string[] = [];
    for (const [key, value] of Object.entries(fields)) {
      if (key === 'primaryKey' || typeof value === 'object') continue;
      if (value !== null && value !== undefined && value !== '') {
        values.push(String(value));
      }
    }

    return values.slice(0, 3).join(' • ');
  }

  /**
   * Check if field is required
   */
  isFieldRequired(): boolean {
    return this.field.required || false;
  }

  /**
   * Check if field is read-only
   */
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
   * Get placeholder text
   */
  getPlaceholder(): string {
    const entityName = this.config.entitySelectorMeta?.entityName || 'entity';
    return `Select ${entityName}`;
  }

  /**
   * Open entity search modal
   */
  openEntitySearchModal(): void {
    if (this.isFieldReadOnly()) {
      return;
    }

    if (!this.config.entitySelectorMeta) {
      console.error('EntitySelectorMeta is required for entity selection');
      return;
    }

    this.isModalOpen = true;
  }

  /**
   * Close entity search modal
   */
  closeEntitySearchModal(): void {
    this.isModalOpen = false;
    this.cdr.markForCheck();
  }

  /**
   * Handle modal save
   */
  onModalSave(result: EntitySearchResult[] | undefined): void {
    if (result) {
      this.handleEntitySelection(result);
    }
    this.closeEntitySearchModal();
  }

  /**
   * Handle entity selection from modal
   */
  private handleEntitySelection(selection: EntitySearchResult[]): void {
    if (!selection || selection.length === 0) {
      return;
    }

    // Store selected entities for table display
    this.selectedEntities = selection;

    // Initialize table columns from first entity
    if (this.selectedEntities.length > 0) {
      this.initializeTableColumns();
      this.initializeNewTable();
    }

    const isMultiSelect = this.config.entitySelectorMeta?.isMultiSelect || false;

    // Prepare entity values in the format expected by backend (matching original implementation)
    // Format: { fields: {...}, meta: {...} } - textSummary is NOT included in backend payload
    const preparedValues = selection.map(item => ({
      fields: item.value.fields,
      meta: item.value.meta
    }));

    if (isMultiSelect) {
      // Multi-select: emit array of entity values
      this.valueChange.emit(preparedValues);
    } else {
      // Single select: emit single entity value
      this.valueChange.emit(preparedValues[0]);
    }
  }

  /**
   * Get display value for the field
   */
  getDisplayValue(): string {
    // Don't show anything in the input field
    return '';
  }

  /**
   * Initialize table columns from entity definition fields
   */
  private initializeTableColumns(): void {
    if (this.selectedEntities.length === 0) return;

    // Get fields from first entity's value
    const firstEntity = this.selectedEntities[0];
    const fields = firstEntity.value.fields || {};

    // Create columns for fields that should be included in summary
    // Filter out primaryKey and complex objects
    this.displayColumns = Object.keys(fields)
      .filter(fieldName => {
        const value = fields[fieldName];
        // Skip primaryKey and complex objects (arrays, nested objects)
        if (fieldName === 'primaryKey') return false;
        if (Array.isArray(value)) return false;
        if (value !== null && typeof value === 'object' && !this.isSimpleObject(value)) return false;
        return true;
      })
      .map(fieldName => ({
        name: fieldName,
        label: fieldName // Use field name as label
      }));

    // Build table columns array (includes actions column on the left if not readonly)
    this.tableColumns = this.isFieldReadOnly()
      ? this.displayColumns.map(col => col.name)
      : ['actions', ...this.displayColumns.map(col => col.name)];
  }

  /**
   * Check if value is a simple object (not a complex nested structure)
   */
  private isSimpleObject(value: any): boolean {
    if (typeof value !== 'object' || value === null) return false;
    // Check if it has nested objects or arrays
    return !Object.values(value).some(v =>
      typeof v === 'object' && v !== null
    );
  }

  /**
   * Get field value for display in table
   */
  getFieldValue(entity: EntitySearchResult, fieldName: string): string {
    const value = entity.value.fields?.[fieldName];

    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
      // Handle simple objects by showing JSON
      return JSON.stringify(value);
    }

    return String(value);
  }

  /**
   * Get field type from entity definition
   */
  getFieldType(entity: EntitySearchResult, fieldName: string): string {
    // Get field definition from entity meta
    const fieldDef = this.getFieldDefinition(fieldName);
    return fieldDef?.fieldType || '';
  }

  /**
   * Get field definition from entity selector meta
   */
  private getFieldDefinition(fieldName: string): any {
    if (!this.config.entitySelectorMeta?.entityDefinition?.fields) {
      return null;
    }

    const fields = this.config.entitySelectorMeta.entityDefinition.fields;

    // Handle both array and object formats
    // Backend may send fields as object (key-value pairs) or array
    if (Array.isArray(fields)) {
      return fields.find((f: any) => f.name === fieldName);
    } else if (typeof fields === 'object') {
      // Fields is an object with field names as keys
      return fields[fieldName] || null;
    }

    return null;
  }

  /**
   * Create a FormField object for switch field display in table
   */
  createSwitchFieldForDisplay(entity: EntitySearchResult, fieldName: string): FormField {
    const fieldDef = this.getFieldDefinition(fieldName);
    const value = this.getFieldBooleanValue(entity, fieldName);

    return {
      name: fieldName,
      displayName: fieldDef?.displayName || fieldName,
      fieldType: 'com.krista.fields.Switch',
      value: value,
      required: false,
      readOnly: true,
      attributes: new Map()
    } as FormField;
  }

  /**
   * Get boolean value from entity field
   */
  private getFieldBooleanValue(entity: EntitySearchResult, fieldName: string): boolean {
    const value = entity.value.fields?.[fieldName];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      return lower === 'true' || lower === 'yes';
    }
    return false;
  }

  /**
   * Create a FormField object for multi field display in table
   */
  createMultiFieldForDisplay(entity: EntitySearchResult, fieldName: string): FormField {
    const fieldDef = this.getFieldDefinition(fieldName);
    const value = entity.value.fields?.[fieldName] || {};

    return {
      name: fieldName,
      displayName: fieldDef?.displayName || fieldName,
      fieldType: 'com.krista.fields.MultiField',
      value: value,
      required: false,
      readOnly: true,
      attributes: new Map(),
      attributeValues: fieldDef?.attributeValues || {}
    } as FormField;
  }

  /**
   * Get sub-fields for MultiField display in table
   */
  getMultiFieldSubFields(entity: EntitySearchResult, fieldName: string): FormField[] {
    const fieldDef = this.getFieldDefinition(fieldName);
    const subFieldsJson = fieldDef?.attributeValues?.['fields'];

    if (!subFieldsJson || !Array.isArray(subFieldsJson)) {
      return [];
    }

    const multiFieldValue = entity.value.fields?.[fieldName] || {};

    // Convert sub-field definitions to FormField objects
    return subFieldsJson.map((subFieldJson: any) => {
      const subFieldName = subFieldJson.name;
      const subFieldValue = multiFieldValue[subFieldName];

      return {
        name: subFieldName,
        displayName: subFieldJson.displayName || subFieldName,
        fieldType: subFieldJson.fieldType,
        value: subFieldValue,
        required: subFieldJson.required || false,
        readOnly: true,
        attributes: new Map(),
        attributeValues: subFieldJson.attributeValues || {}
      } as FormField;
    });
  }

  /**
   * Get rating stars array for display
   */
  getRatingStars(entity: EntitySearchResult, fieldName: string): { filled: boolean }[] {
    const value = entity.value.fields?.[fieldName];
    const rating = typeof value === 'number' ? value : parseInt(value);

    if (isNaN(rating)) return [];

    const maxRating = 5;
    const stars: { filled: boolean }[] = [];

    for (let i = 1; i <= maxRating; i++) {
      stars.push({ filled: i <= rating });
    }

    return stars;
  }

  /**
   * Remove entity from selection
   */
  removeEntity(entity: EntitySearchResult): void {
    // Remove from selected entities array
    this.selectedEntities = this.selectedEntities.filter(e =>
      e.value.meta.primaryKey !== entity.value.meta.primaryKey
    );

    // Reset selected cell when entities change
    this.resetSelectedCell();

    // Emit updated value
    const isMultiSelect = this.config.entitySelectorMeta?.isMultiSelect || false;

    if (this.selectedEntities.length === 0) {
      // No entities left, emit null/empty
      this.valueChange.emit(isMultiSelect ? [] : null);
    } else {
      // Prepare entity values in the format expected by backend (matching original implementation)
      // Format: { fields: {...}, meta: {...} } - textSummary is NOT included in backend payload
      const preparedValues = this.selectedEntities.map(item => ({
        fields: item.value.fields,
        meta: item.value.meta
      }));

      if (isMultiSelect) {
        // Multi-select: emit array of entity values
        this.valueChange.emit(preparedValues);
      } else {
        // Single select: emit single entity value
        this.valueChange.emit(preparedValues[0]);
      }
    }
  }

  /**
   * Handle cell click to display cell data in selected entities table
   */
  onCellClick(entity: EntitySearchResult, columnName: string, rowIndex: number, colIndex: number): void {
    // Update selected cell position
    this.selectedCellRow = rowIndex;
    this.selectedCellCol = colIndex;

    // Get the raw cell value from entity
    const rawValue = entity.value.fields?.[columnName];

    // Format the cell data based on field type
    const fieldType = this.getFieldType(entity, columnName);

    if (fieldType === 'com.krista.fields.Switch') {
      this.selectedCellData = rawValue ? 'Yes' : 'No';
    } else if (fieldType === 'com.krista.fields.Rating') {
      const rating = typeof rawValue === 'number' ? rawValue : (parseInt(rawValue) || 0);
      this.selectedCellData = `Rating: ${rating} / 5`;
    } else if (fieldType === 'com.krista.fields.MultiField') {
      // For MultiField, show a formatted representation
      if (typeof rawValue === 'object' && rawValue !== null) {
        this.selectedCellData = JSON.stringify(rawValue, null, 2);
      } else {
        this.selectedCellData = String(rawValue || '');
      }
    } else {
      // Default: use the formatted display value
      this.selectedCellData = this.getFieldValue(entity, columnName);
    }
  }

  /**
   * Check if a cell is currently selected
   */
  isSelectedCell(rowIndex: number, colIndex: number): boolean {
    return this.selectedCellRow === rowIndex && this.selectedCellCol === colIndex;
  }

  /**
   * Reset selected cell
   */
  private resetSelectedCell(): void {
    this.selectedCellData = '';
    this.selectedCellRow = -1;
    this.selectedCellCol = -1;
  }

  /**
   * Initialize NewTable component with selected entities
   */
  private initializeNewTable(): void {
    if (!this.config.entitySelectorMeta || this.selectedEntities.length === 0) {
      this.tableInput = undefined;
      return;
    }

    // Create entity definition from the first entity's fields
    const firstEntity = this.selectedEntities[0];
    const fields = firstEntity.value.fields || {};

    const entityDefinition: EntityDefinition = {
      fields: Object.keys(fields)
        .filter(fieldName => {
          const value = fields[fieldName];
          if (fieldName === 'primaryKey') return false;

          // Get field definition to check field type
          const fieldDef = this.getFieldDefinition(fieldName);
          const fieldType = fieldDef?.fieldType || '';

          // Allow arrays for PickMany/Checkboxes fields (they have array values like ["Option1", "Option2"])
          if (Array.isArray(value)) {
            // Check if it's a PickMany/Checkboxes field - allow these
            if (fieldType.includes('PickMany') || fieldType.includes('Checkboxes')) {
              return true;
            }
            // Exclude other array fields (like File arrays with complex objects)
            return false;
          }

          if (value !== null && typeof value === 'object' && !this.isSimpleObject(value)) return false;
          return true;
        })
        .map(fieldName => {
          const fieldDef = this.getFieldDefinition(fieldName);
          const fullFieldType = fieldDef?.fieldType || fieldDef?.type || 'com.krista.fields.Text';

          // Return the full field definition object to preserve attributeValues
          return fieldDef || {
            name: fieldName,
            type: fullFieldType,
            fieldType: fullFieldType,
            attributeValues: {}
          };
        })
    };

    // Convert selected entities to EntityValue format
    const entityValues: EntityValue[] = this.selectedEntities.map(entity => {
      const entityType: any = entity.value.meta?.entityType;
      return {
        fields: entity.value.fields,
        meta: {
          primaryKey: entity.value.meta?.primaryKey || '',
          entityType: {
            registry: entityType?.registry || '',
            name: entityType?.name || ''
          }
        },
        textSummary: entity.textSummary
      };
    });

    // Create table config
    const isMultiSelect = this.config.entitySelectorMeta?.isMultiSelect || false;
    const isReadOnly = this.isFieldReadOnly();

    const tableConfig: TableConfig = {
      defaultColumnConfig: {},
      loadStrategy: "None",
      allowEditCells: false,
      stickyHeader: true,
      allowRemoveRows: !isReadOnly,
      showCellSelectionData: true,
      selection: isMultiSelect ? "MULTI SELECT" : "SINGLE",
      pageSize: 10,
      onSelection: new EventEmitter<Set<String>>(),
      onRemoveSelection: new EventEmitter<any>(),
      onPageChange: new EventEmitter<any>(),
      hideFooter: isReadOnly,  // Hide footer (pagination + remove button) in readonly mode
      readonly: isReadOnly,
      showBorder: true
    };

    // Subscribe to remove selection events
    if (tableConfig.onRemoveSelection) {
      tableConfig.onRemoveSelection.subscribe((removedRows: any[]) => {
        this.handleTableRowRemoval(removedRows);
      });
    }

    // Create data source
    const dataSource = new EntitySelectorTable(
      entityDefinition,
      entityValues,
      (headerCell: any, rawValue: any) => {
        // Action cell clicked - can be extended for custom behavior
      }
    );

    // Create table input
    this.tableInput = {
      tableConfig,
      dataSource,
      selectedRowKey: new Set()
    };
  }

  /**
   * Handle row removal from NewTable
   */
  private handleTableRowRemoval(removedRows: any[]): void {
    if (!removedRows || removedRows.length === 0) return;

    // Get the unique keys of removed rows
    const removedKeys = new Set(removedRows.map(row => row.uniqueKey));

    // Filter out removed entities
    this.selectedEntities = this.selectedEntities.filter((entity, index) => {
      const key = entity.value.meta?.primaryKey || String(index);
      return !removedKeys.has(key);
    });

    // Reinitialize table
    if (this.selectedEntities.length > 0) {
      this.initializeNewTable();
    } else {
      this.tableInput = undefined;
    }

    // Emit updated value
    const isMultiSelect = this.config.entitySelectorMeta?.isMultiSelect || false;
    const preparedValues = this.selectedEntities.map(item => ({
      fields: item.value.fields,
      meta: item.value.meta
    }));

    if (isMultiSelect) {
      this.valueChange.emit(preparedValues);
    } else {
      this.valueChange.emit(preparedValues.length > 0 ? preparedValues[0] : null);
    }
  }
}

