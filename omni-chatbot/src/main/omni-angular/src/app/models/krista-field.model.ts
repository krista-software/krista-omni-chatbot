import { FormField } from './message.model';
import { FieldValidator } from './validators/field-validator.interface';
import { FieldFormatter } from './formatters/field-formatter.interface';

/**
 * KristaField - Encapsulates field data with validation and formatting logic
 * 
 * This class wraps a FormField and provides:
 * - Value management with change tracking
 * - Validation with error messages
 * - Formatting for display and on blur
 * - Computed properties for UI binding
 * 
 * Inspired by original KristaTypeField but adapted for Angular patterns
 */
export class KristaField {
  private _value: any;
  private _formattedValue: string = '';
  private _errors: string[] = [];
  private _isDirty: boolean = false;
  private _isTouched: boolean = false;

  /**
   * Create a new KristaField instance
   * @param fieldData - The underlying FormField data
   * @param validators - Array of validators to apply to this field
   * @param formatter - Formatter for this field type
   */
  constructor(
    public readonly fieldData: FormField,
    private validators: FieldValidator[],
    private formatter: FieldFormatter
  ) {
    this._value = fieldData.value;
    this._formattedValue = this.format();
  }

  // ============================================================================
  // Getters - Computed properties for UI binding
  // ============================================================================

  /**
   * Get the current field value
   */
  get value(): any {
    return this._value;
  }

  /**
   * Get the formatted display value
   */
  get formattedValue(): string {
    return this._formattedValue;
  }

  /**
   * Get the field name/ID
   */
  get fieldId(): string {
    return this.fieldData.name;
  }

  /**
   * Get the field display label
   */
  get displayLabel(): string {
    return this.fieldData.name;
  }

  /**
   * Get the field type
   */
  get fieldType(): string {
    return this.fieldData.fieldType;
  }

  /**
   * Check if field is valid (no errors)
   */
  get isValid(): boolean {
    return this._errors.length === 0;
  }

  /**
   * Get validation errors
   */
  get errors(): string[] {
    return [...this._errors];
  }

  /**
   * Get first error message (for display)
   */
  get errorMessage(): string | null {
    return this._errors.length > 0 ? this._errors[0] : null;
  }

  /**
   * Check if field is required
   */
  get required(): boolean {
    return this.fieldData.required || false;
  }

  /**
   * Check if field is read-only
   */
  get readOnly(): boolean {
    return this.fieldData.readOnly || false;
  }

  /**
   * Check if field value has been changed
   */
  get isDirty(): boolean {
    return this._isDirty;
  }

  /**
   * Check if field has been touched (focused and blurred)
   */
  get isTouched(): boolean {
    return this._isTouched;
  }

  /**
   * Check if field has a non-empty value
   */
  get hasValue(): boolean {
    if (this._value === undefined || this._value === null || this._value === '') {
      return false;
    }

    // For arrays
    if (Array.isArray(this._value)) {
      return this._value.length > 0;
    }

    // For objects
    if (typeof this._value === 'object') {
      return Object.values(this._value).some(v => v !== undefined && v !== null && v !== '');
    }

    return true;
  }

  /**
   * Get field attributes
   */
  get attributes(): { [key: string]: any } {
    return this.fieldData.attributeValues || {};
  }

  /**
   * Get field options
   */
  get options(): { [key: string]: any } {
    return this.fieldData.options || {};
  }

  // ============================================================================
  // Methods - Value management and validation
  // ============================================================================

  /**
   * Set a new value for the field
   * This will:
   * - Update the internal value
   * - Mark field as dirty
   * - Reformat the value
   * - Validate the new value
   * 
   * @param newValue - The new value to set
   * @param markAsDirty - Whether to mark field as dirty (default: true)
   */
  setValue(newValue: any, markAsDirty: boolean = true): void {
    const hasChanged = this._value !== newValue;
    
    this._value = newValue;
    this._formattedValue = this.format();
    
    if (markAsDirty && hasChanged) {
      this._isDirty = true;
    }

    // Auto-validate after value change
    this.validate();
  }

  /**
   * Mark field as touched (user has interacted with it)
   */
  markAsTouched(): void {
    this._isTouched = true;
  }

  /**
   * Mark field as pristine (reset dirty state)
   */
  markAsPristine(): void {
    this._isDirty = false;
  }

  /**
   * Mark field as untouched (reset touched state)
   */
  markAsUntouched(): void {
    this._isTouched = false;
  }

  /**
   * Reset field to initial state
   */
  reset(): void {
    this._value = this.fieldData.value;
    this._formattedValue = this.format();
    this._errors = [];
    this._isDirty = false;
    this._isTouched = false;
  }

  /**
   * Validate the current field value
   * Runs all validators and collects error messages
   * 
   * @returns true if valid, false if invalid
   */
  validate(): boolean {
    this._errors = [];

    for (const validator of this.validators) {
      const result = validator.validate(this._value, this.fieldData);
      if (!result.isValid && result.errorMessage) {
        this._errors.push(result.errorMessage);
      }
    }

    return this.isValid;
  }

  /**
   * Format the current value for display
   * 
   * @returns Formatted string value
   */
  format(): string {
    return this.formatter.format(this._value, this.fieldData);
  }

  /**
   * Format value on blur (more aggressive formatting)
   * This is typically called when the field loses focus
   * 
   * @returns Formatted value (updates internal value if changed)
   */
  formatOnBlur(): any {
    const formattedValue = this.formatter.formatOnBlur(this._value, this.fieldData);
    
    // Update value if formatting changed it
    if (formattedValue !== this._value) {
      this.setValue(formattedValue, true);
    }
    
    return formattedValue;
  }

  /**
   * Get the value to send to the server
   * This is the raw value, not the formatted display value
   * 
   * @returns Value for API submission
   */
  toResponse(): any {
    return this._value;
  }

  /**
   * Update the underlying FormField data
   * This syncs the KristaField value back to the FormField
   */
  syncToFormField(): void {
    this.fieldData.value = this._value;
  }
}

