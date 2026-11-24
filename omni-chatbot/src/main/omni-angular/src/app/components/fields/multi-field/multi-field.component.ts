import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef, OnChanges, SimpleChanges } from '@angular/core';
import { FormField, FieldTypes } from '../../../models/message.model';
import { BasicFieldConfig, TextFieldConfig, LocationFieldConfig, FileFieldConfig, AddressFieldConfig } from '../../../models/field-config.model';
import { KristaField } from '../../../models/krista-field.model';

/**
 * MultiField component - renders a composite field with multiple sub-fields
 * Similar to original CompositeFieldRenderer
 * 
 * This component displays a parent label with a left border and renders
 * all sub-fields indented inside the container.
 */
@Component({
  selector: 'app-multi-field',
  templateUrl: './multi-field.component.html',
  styleUrls: ['./multi-field.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class MultiFieldComponent implements OnChanges {
  // Data inputs
  @Input() field!: FormField;
  @Input() subFields: FormField[] = [];  // Array of sub-field definitions
  @Input() config: BasicFieldConfig = {
    hasError: false,
    errorMessage: '',
    readOnly: false
  };
  @Input() kristaFields!: Map<string, KristaField>;  // Map of KristaField instances
  @Input() hasAttemptedSubmit: boolean = false;  // Whether form submission has been attempted
  @Input() workspaceId: string = '';  // Workspace ID for file uploads
  @Input() clientSessionId: string = '';  // Client session ID for file uploads

  // Event outputs
  @Output() subFieldValueChange = new EventEmitter<{fieldName: string, value: any}>();
  @Output() subFieldBlur = new EventEmitter<{fieldName: string, value: any}>();
  @Output() subFieldFocus = new EventEmitter<{fieldName: string}>();
  @Output() keyPress = new EventEmitter<KeyboardEvent>();

  constructor(private cdr: ChangeDetectorRef) {}

  /**
   * Lifecycle hook - detect changes to inputs
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['hasAttemptedSubmit']) {
      // Manually trigger change detection to update error display
      this.cdr.markForCheck();
    }
  }

  /**
   * Get label for the MultiField header.
   * Uses displayLabel (i18n) > displayName (short name) > last segment of name.
   * This avoids showing the full dotted path (e.g., "Multi field1.NestedMulti")
   * for nested MultiFields — only the current element label is shown.
   */
  getLabel(): string {
    const f = this.field as any;
    if (f.displayLabel) return f.displayLabel;
    if (this.field.displayName) return this.field.displayName;
    // Fallback: extract last segment from dotted name
    const name = this.field.name || '';
    const lastDot = name.lastIndexOf('.');
    return lastDot >= 0 ? name.substring(lastDot + 1) : name;
  }

  private static readonly COMPLEX_TYPES = [
    'com.krista.fields.MultiField',
    'com.krista.fields.Composite',
    'com.krista.fields.EntityReference',
    'com.krista.fields.Address',
    'com.krista.fields.List',
    'com.krista.fields.Table',
  ];

  /**
   * Get the visual width style for a sub-field based on its visualWidth attribute.
   * Matches original's CompositeFieldRenderer: complex/readonly fields get auto width,
   * others get S=250px, M=375px, L=500px.
   */
  getSubFieldWidth(subField: FormField): { [key: string]: string } {
    if (this.isFieldReadOnly() || MultiFieldComponent.COMPLEX_TYPES.includes(subField.fieldType)) {
      return {};
    }
    const vw = (subField.attributeValues?.['visualWidth'] || 's').toString().toLowerCase();
    switch (vw) {
      case 'm': return { width: '375px', 'max-width': '100%' };
      case 'l': return { width: '500px', 'max-width': '100%' };
      default:  return { width: '250px', 'max-width': '100%' };
    }
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
    return this.config?.readOnly || false;
  }

  /**
   * Check if label should be shown
   * Defaults to true if not specified in config
   */
  shouldShowLabel(): boolean {
    return this.config?.showLabel !== false; // Show by default unless explicitly set to false
  }

  /**
   * Handle sub-field value change
   */
  onSubFieldChange(fieldName: string, value: any): void {
    this.subFieldValueChange.emit({ fieldName, value });
  }

  /**
   * Handle nested sub-field value change (from nested MultiFields)
   * This propagates changes from deeply nested fields up to the parent
   */
  onNestedSubFieldChange(event: {fieldName: string, value: any}): void {
    // Re-emit the event as-is - the fieldName already contains the full path
    this.subFieldValueChange.emit(event);
  }

  /**
   * Handle sub-field blur event
   */
  onSubFieldBlur(fieldName: string, value: any): void {
    this.subFieldBlur.emit({ fieldName, value });
  }

  /**
   * Handle sub-field focus event
   */
  onSubFieldFocus(fieldName: string): void {
    this.subFieldFocus.emit({ fieldName });
  }

  /**
   * Handle key press event
   */
  onKeyPress(event: KeyboardEvent): void {
    this.keyPress.emit(event);
  }

  /**
   * Get config for a sub-field
   * Sub-fields inherit readonly state from parent but have their own validation
   */
  getSubFieldConfig(subField: FormField): BasicFieldConfig {
    // Get KristaField instance for this sub-field
    const kristaField = this.kristaFields?.get(subField.name);
    const isValid = kristaField ? kristaField.isValid : true;

    // Only show errors after form submission attempt
    const shouldShowError = this.hasAttemptedSubmit && !isValid;

    return {
      hasError: shouldShowError,
      errorMessage: shouldShowError ? (kristaField?.errorMessage || '') : '',
      readOnly: this.isFieldReadOnly()
    };
  }

  /**
   * Get config for text-based sub-fields
   */
  getTextFieldConfig(subField: FormField): TextFieldConfig {
    // Get KristaField instance for this sub-field
    const kristaField = this.kristaFields?.get(subField.name);
    const isValid = kristaField ? kristaField.isValid : true;

    // Only show errors after form submission attempt
    const shouldShowError = this.hasAttemptedSubmit && !isValid;

    // Get display value from KristaField's formattedValue if available
    // This properly formats phone objects, dates, etc.
    let displayValue = '';
    if (kristaField) {
      displayValue = kristaField.formattedValue || '';
    } else if (subField.value !== null && subField.value !== undefined) {
      // Fallback: convert to string (but this won't work well for objects)
      displayValue = subField.value.toString();
    }

    return {
      displayValue: displayValue,
      inputType: 'text', // Default to text, specific types handled by field components
      hasError: shouldShowError,
      errorMessage: shouldShowError ? (kristaField?.errorMessage || '') : '',
      readOnly: this.isFieldReadOnly()
    };
  }

  /**
   * Get config for number-based sub-fields
   */
  getNumberFieldConfig(subField: FormField): TextFieldConfig {
    // Get KristaField instance for this sub-field
    const kristaField = this.kristaFields?.get(subField.name);
    const isValid = kristaField ? kristaField.isValid : true;

    // Only show errors after form submission attempt
    const shouldShowError = this.hasAttemptedSubmit && !isValid;

    // Get display value from KristaField's formattedValue if available
    let displayValue = '';
    if (kristaField) {
      displayValue = kristaField.formattedValue || '';
    } else if (subField.value !== null && subField.value !== undefined) {
      displayValue = subField.value.toString();
    }

    return {
      displayValue: displayValue,
      inputType: 'number',
      hasError: shouldShowError,
      errorMessage: shouldShowError ? (kristaField?.errorMessage || '') : '',
      readOnly: this.isFieldReadOnly()
    };
  }

  /**
   * Get config for location sub-fields
   */
  getLocationFieldConfig(subField: FormField): LocationFieldConfig {
    // Get KristaField instance for this sub-field
    const kristaField = this.kristaFields?.get(subField.name);
    const isValid = kristaField ? kristaField.isValid : true;

    // Only show errors after form submission attempt
    const shouldShowError = this.hasAttemptedSubmit && !isValid;

    // Get display value from KristaField's formattedValue if available
    let displayValue = '';
    if (kristaField) {
      displayValue = kristaField.formattedValue || '';
    } else if (subField.value) {
      // Fallback: try to format location value
      if (typeof subField.value === 'object' && subField.value.latitude !== undefined) {
        const loc = subField.value;
        if (loc.address) {
          displayValue = loc.address;
        } else if (loc.city || loc.country) {
          const parts = [loc.area, loc.city, loc.state, loc.zip, loc.country].filter((p: any) => p);
          displayValue = parts.join(', ');
        } else {
          displayValue = `${loc.latitude}, ${loc.longitude}`;
        }
      } else {
        displayValue = String(subField.value);
      }
    }

    return {
      displayValue: displayValue,
      allowMapSelection: true,
      hasError: shouldShowError,
      errorMessage: shouldShowError ? (kristaField?.errorMessage || '') : '',
      readOnly: this.isFieldReadOnly()
    };
  }

  /**
   * Get config for file sub-fields
   */
  getFileFieldConfig(subField: FormField): FileFieldConfig {
    // Get KristaField instance for this sub-field
    const kristaField = this.kristaFields?.get(subField.name);
    const isValid = kristaField ? kristaField.isValid : true;

    // Only show errors after form submission attempt
    const shouldShowError = this.hasAttemptedSubmit && !isValid;

    return {
      workspaceId: this.workspaceId,
      clientSessionId: this.clientSessionId,
      hasError: shouldShowError,
      errorMessage: shouldShowError ? (kristaField?.errorMessage || '') : '',
      readOnly: this.isFieldReadOnly()
    };
  }

  /**
   * Get address value for address field
   */
  getAddressValue(field: FormField): any {
    return field.value || {};
  }

  /**
   * Get config for address field
   */
  getAddressFieldConfig(field: FormField): AddressFieldConfig {
    const kristaField = this.kristaFields?.get(field.name);
    const isValid = kristaField ? kristaField.isValid : true;
    const shouldShowError = this.hasAttemptedSubmit && !isValid;

    return {
      hasError: shouldShowError,
      errorMessage: shouldShowError ? (kristaField?.errorMessage || '') : '',
      readOnly: this.isFieldReadOnly()
    };
  }

  /**
   * Get sub-fields for nested MultiField/Composite fields
   * This is needed when a MultiField contains another MultiField
   */
  getSubFieldsForNestedField(subField: FormField): FormField[] {
    // Check if this sub-field is a MultiField or Composite that has nested fields
    const isMultiFieldType = subField.fieldType === FieldTypes.MULTI_FIELD ||
                             subField.fieldType === FieldTypes.COMPOSITE_FIELD;

    if (!isMultiFieldType) {
      return [];
    }

    // Sub-fields are stored in attributeValues.fields as an array
    const nestedFieldsJson = subField.attributeValues?.['fields'];

    if (!nestedFieldsJson || !Array.isArray(nestedFieldsJson)) {
      return [];
    }

    // Convert to FormField objects with proper naming
    const nestedFields: FormField[] = nestedFieldsJson.map((nestedFieldJson: any) => {
      const nestedFieldFullName = `${subField.name}.${nestedFieldJson.name}`;
      const isRequired = nestedFieldJson.options?.required?.value || false;

      return {
        fieldId: nestedFieldFullName,
        name: nestedFieldFullName,
        displayName: nestedFieldJson.name,
        fieldType: nestedFieldJson.fieldType,
        value: subField.value?.[nestedFieldJson.name],
        required: isRequired,
        readOnly: this.isFieldReadOnly() || nestedFieldJson.readOnly || false,
        attributeValues: nestedFieldJson.attributeValues || {},
        options: nestedFieldJson.options || {}
      } as FormField;
    });

    return nestedFields;
  }

  /**
   * Track by function for ngFor optimization
   */
  trackByFieldName(index: number, field: FormField): string {
    return field.name;
  }
}

