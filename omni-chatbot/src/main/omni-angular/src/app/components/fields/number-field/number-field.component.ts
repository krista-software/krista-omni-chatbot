import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { FormField } from '../../../models/message.model';
import { TextFieldConfig } from '../../../models/field-config.model';
import { TranslateService } from '@ngx-translate/core';
import { getFieldLabel } from '../shared/field-label.utils';

/**
 * Pure presentation component for numeric input fields.
 * Handles Number, Currency, Unit, and Percentage fields.
 * Similar to krista-client's NumberFieldRenderer.
 *
 * This component only handles rendering and user interaction.
 * All business logic (formatting, validation, etc.) is handled by the parent.
 */
@Component({
  selector: 'app-number-field',
  templateUrl: './number-field.component.html',
  styleUrls: ['./number-field.component.css'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NumberFieldComponent {
  // Data inputs
  @Input() field!: FormField;
  @Input() config: TextFieldConfig = {
    displayValue: '',
    inputType: 'text',
    hasError: false,
    errorMessage: '',
    readOnly: false,
    placeholder: undefined,
    rows: 4
  };

  // Event outputs (emit raw values, parent handles business logic)
  @Output() valueChange = new EventEmitter<any>();
  @Output() blur = new EventEmitter<any>();
  @Output() focus = new EventEmitter<void>();
  @Output() keyPress = new EventEmitter<KeyboardEvent>();

  constructor(private translate: TranslateService) {}

  /**
   * Handle value changes - emit raw value to parent
   */
  onValueChange(value: any): void {
    this.valueChange.emit(value);
  }

  /**
   * Handle blur event - emit raw value to parent for formatting
   */
  onBlur(value: any): void {
    this.blur.emit(value);
  }

  /**
   * Handle focus event
   */
  onFocus(): void {
    this.focus.emit();
  }

  /**
   * Handle key press event - validate numeric input
   */
  onKeyPress(event: KeyboardEvent): void {
    // Validate numeric input (allow numbers, decimal point, minus sign)
    const char = event.key;
    const inputElement = event.target as HTMLInputElement;
    const currentValue = inputElement.value;

    // Allow control keys
    if (event.ctrlKey || event.metaKey ||
        ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(char)) {
      this.keyPress.emit(event);
      return;
    }

    // Allow numbers, decimal point (only one), and minus sign (only at start)
    if (/[0-9]/.test(char) ||
        (char === '.' && !currentValue.includes('.')) ||
        (char === '-' && currentValue.length === 0)) {
      this.keyPress.emit(event);
      return;
    }

    // Block all other characters
    event.preventDefault();
  }

  /**
   * Handle paste event - validate numeric input
   */
  onPaste(event: ClipboardEvent): void {
    const pastedText = event.clipboardData?.getData('text/plain') || '';

    // Check if pasted text is a valid number
    if (isNaN(Number(pastedText))) {
      event.preventDefault();
    }
  }

  /**
   * Presentation logic: Check if field is required
   */
  isFieldRequired(): boolean {
    return this.field.required || false;
  }

  /**
   * Presentation logic: Check if field is readonly
   */
  isFieldReadOnly(): boolean {
    return this.config.readOnly || this.field.readOnly || false;
  }

  /**
   * Check if label should be shown
   * Defaults to true if not specified in config
   */
  shouldShowLabel(): boolean {
    return this.config.showLabel !== false; // Show by default unless explicitly set to false
  }

  /**
   * Get field label with i18n support
   * Uses shared utility function for consistency across all field types
   */
  getFieldLabel(): string {
    return getFieldLabel(this.field);
  }

  /**
   * Presentation logic: Get placeholder text
   * Uses translation service like original app does
   */
  getPlaceholder(): string {
    if (this.config.placeholder !== undefined) {
      return this.config.placeholder;
    }

    if (this.isFieldReadOnly()) {
      return '';
    }

    // Use displayName if available (for sub-fields), otherwise use name
    const fieldName = this.field.displayName || this.field.name;
    // Use translation service like: t("placeholder.enter", { fieldName })
    return this.translate.instant('placeholder.enter', { fieldName });
  }

  /**
   * Presentation logic: Get display value
   * Uses pre-formatted displayValue from parent if available,
   * otherwise falls back to raw field value
   */
  getDisplayValue(): string {
    // Use pre-formatted display value from parent if provided
    if (this.config.displayValue !== undefined && this.config.displayValue !== null) {
      return this.config.displayValue;
    }

    // Fallback to raw field value
    if (this.field.value === null || this.field.value === undefined) {
      return '';
    }

    return this.field.value.toString();
  }

  /**
   * Check if the field is secured (values should be masked)
   */
  isSecured(): boolean {
    return this.field.attributeValues?.['isSecured'] === true;
  }

  /**
   * Get the input type for the field
   * Returns 'password' for secured fields, 'text' otherwise
   */
  getInputType(): string {
    if (this.isSecured()) {
      return 'password';
    }
    // Use 'text' instead of 'number' for better formatting control
    // This matches krista-client's approach
    return 'text';
  }

  /**
   * Check if this is a percentage field
   */
  isPercentageField(): boolean {
    return this.field.fieldType === 'com.krista.fields.Percentage';
  }

  /**
   * Check if this is a currency field
   */
  isCurrencyField(): boolean {
    return this.field.fieldType === 'com.krista.fields.Currency';
  }
}

