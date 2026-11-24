import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { FormField } from '../../../models/message.model';
import { AddressFieldConfig, TextFieldConfig } from '../../../models/field-config.model';
import { getFieldLabel } from '../shared/field-label.utils';

export interface AddressValue {
  street?: string;
  street2?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

/**
 * Pure presentation component for address fields (compound field).
 * Reuses TextFieldComponent for each subfield (similar to krista-client's CompositeFieldRenderer).
 * This component only handles rendering and user interaction.
 * All business logic (formatting, validation, etc.) is handled by the parent.
 */
@Component({
  selector: 'app-address-field',
  templateUrl: './address-field.component.html',
  styleUrls: ['./address-field.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class AddressFieldComponent {
  // Data inputs
  @Input() field!: FormField;
  @Input() addressValue: AddressValue = {};  // Pre-formatted address value from parent
  @Input() config: AddressFieldConfig = {
    streetDisplayValue: '',
    street2DisplayValue: '',
    cityDisplayValue: '',
    stateDisplayValue: '',
    countryDisplayValue: '',
    postalCodeDisplayValue: '',
    hasError: false,
    errorMessage: '',
    readOnly: false
  };

  // Event outputs (emit raw values, parent handles business logic)
  @Output() valueChange = new EventEmitter<AddressValue>();
  @Output() subFieldBlur = new EventEmitter<{fieldName: keyof AddressValue, value: string}>();
  @Output() subFieldFocus = new EventEmitter<{fieldName: keyof AddressValue}>();
  @Output() keyPress = new EventEmitter<KeyboardEvent>();

  // Subfield definitions (similar to krista-client's addressFields)
  private subFieldLabels: { [key in keyof AddressValue]: string } = {
    street: 'Street Address',
    street2: 'Street Address Line 2',
    city: 'City',
    state: 'State',
    country: 'Country',
    postalCode: 'Postal Code'
  };

  /**
   * Handle sub-field value change
   * Emits the complete address object with updated sub-field
   */
  onSubFieldChange(fieldName: keyof AddressValue, value: string): void {
    const updatedAddress: AddressValue = {
      ...(this.addressValue || {}),
      [fieldName]: value
    };
    this.valueChange.emit(updatedAddress);
  }

  /**
   * Handle sub-field blur event
   * Emits blur event to parent for formatting
   */
  onSubFieldBlur(fieldName: keyof AddressValue, value: string): void {
    this.subFieldBlur.emit({ fieldName, value });
  }

  /**
   * Handle sub-field focus event
   */
  onSubFieldFocus(fieldName: keyof AddressValue): void {
    this.subFieldFocus.emit({ fieldName });
  }

  /**
   * Handle keypress event
   */
  onKeyPress(event: KeyboardEvent): void {
    this.keyPress.emit(event);
  }

  /**
   * Check if field is required
   */
  isFieldRequired(): boolean {
    return this.field.required || false;
  }

  isSecured(): boolean {
    return this.field?.attributeValues?.['isSecured'] === true;
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
   * Get field label with i18n support
   * Uses shared utility function for consistency across all field types
   */
  getFieldLabel(): string {
    return getFieldLabel(this.field);
  }

  /**
   * Get FormField definition for a subfield
   * Creates a synthetic FormField object for the TextFieldComponent
   *
   * Note: All address subfields use text fields in krista-client, including postal code.
   * This is because postal codes can contain letters (e.g., Canadian "K1A 0B1", UK "SW1A 1AA")
   * and can have leading zeros that would be lost if treated as numbers.
   */
  getSubFieldDefinition(fieldName: keyof AddressValue): FormField {
    // Map field names to their specific field types (matching krista-client)
    const fieldTypeMap: { [key in keyof AddressValue]: string } = {
      street: 'com.krista.fields.Street',
      street2: 'com.krista.fields.Street2',
      city: 'com.krista.fields.City',
      state: 'com.krista.fields.State',
      country: 'com.krista.fields.Country',
      postalCode: 'com.krista.fields.PostalCode'  // Text field, not number
    };

    // Auto-capitalize fields (matching krista-client's AutoCapitalizeField behavior)
    const autoCapitalizeFields = ['street', 'street2', 'city', 'state', 'country'];
    const shouldAutoCapitalize = autoCapitalizeFields.includes(fieldName);

    // When parent Address field is required, all sub-fields except street2 are required
    // This matches original app behavior
    const isRequired = this.field?.required && fieldName !== 'street2';

    // Safely access addressValue with null check
    const safeAddressValue = this.addressValue || {};

    return {
      name: this.subFieldLabels[fieldName],
      fieldType: fieldTypeMap[fieldName],
      value: safeAddressValue[fieldName] || '',
      required: isRequired,
      readOnly: this.config?.readOnly || this.field?.readOnly || false,
      attributeValues: {
        toolTip: '',
        autoCapitalize: shouldAutoCapitalize ? 'words' : 'none',
        trim: true,
        isSecured: this.field?.attributeValues?.['isSecured'] || false
      }
    } as FormField;
  }

  /**
   * Get TextFieldConfig for a subfield
   * Creates config object for the TextFieldComponent
   */
  getSubFieldConfig(fieldName: keyof AddressValue): TextFieldConfig {
    // Safely access config and addressValue with null checks
    const safeConfig = this.config || {};
    const safeAddressValue = this.addressValue || {};

    // Map of display value inputs
    const displayValues: { [key in keyof AddressValue]: string } = {
      street: safeConfig.streetDisplayValue || '',
      street2: safeConfig.street2DisplayValue || '',
      city: safeConfig.cityDisplayValue || '',
      state: safeConfig.stateDisplayValue || '',
      country: safeConfig.countryDisplayValue || '',
      postalCode: safeConfig.postalCodeDisplayValue || ''
    };

    const placeholders: { [key in keyof AddressValue]: string } = {
      street: 'Enter street address',
      street2: 'Apt, suite, etc. (optional)',
      city: 'Enter city',
      state: 'Enter state',
      country: 'Enter country',
      postalCode: 'Enter postal code'
    };

    // Check if this specific sub-field is required and empty
    const subFieldDef = this.getSubFieldDefinition(fieldName);
    const subFieldValue = safeAddressValue[fieldName];
    const isEmpty = !subFieldValue || subFieldValue.toString().trim() === '';
    const hasError = !!(subFieldDef.required && isEmpty && safeConfig.hasError);

    return {
      displayValue: displayValues[fieldName] || safeAddressValue[fieldName] || '',
      inputType: 'text',
      hasError: hasError,
      errorMessage: hasError ? 'This field is required.' : '',
      readOnly: safeConfig.readOnly || this.field?.readOnly || false,
      placeholder: placeholders[fieldName],
      rows: 1
    };
  }

  /**
   * Get placeholder for sub-field
   */
  getSubFieldPlaceholder(fieldName: keyof AddressValue): string {
    if (this.isFieldReadOnly()) return '';

    const placeholders: { [key in keyof AddressValue]: string } = {
      street: 'Enter street address',
      street2: 'Apt, suite, etc. (optional)',
      city: 'Enter city',
      state: 'Enter state',
      country: 'Enter country',
      postalCode: 'Enter postal code'
    };

    return placeholders[fieldName] || '';
  }

  /**
   * Get display value for a sub-field
   * Uses pre-formatted value from parent if provided, otherwise falls back to raw value
   */
  getSubFieldDisplayValue(fieldName: keyof AddressValue): string {
    // Map of display value inputs
    const displayValues: { [key in keyof AddressValue]: string } = {
      street: this.config?.streetDisplayValue || '',
      street2: this.config?.street2DisplayValue || '',
      city: this.config?.cityDisplayValue || '',
      state: this.config?.stateDisplayValue || '',
      country: this.config?.countryDisplayValue || '',
      postalCode: this.config?.postalCodeDisplayValue || ''
    };

    // Use pre-formatted display value if provided
    const displayValue = displayValues[fieldName];
    if (displayValue !== undefined && displayValue !== null && displayValue !== '') {
      return displayValue;
    }

    // Fallback to raw value from addressValue
    const rawValue = (this.addressValue || {})[fieldName];
    return rawValue || '';
  }

  /**
   * Get formatted readonly value (complete address string)
   * Uses pre-formatted display values
   */
  getFormattedReadOnlyValue(): string {
    const parts: string[] = [];

    if (this.getSubFieldDisplayValue('street')) parts.push(this.getSubFieldDisplayValue('street'));
    if (this.getSubFieldDisplayValue('street2')) parts.push(this.getSubFieldDisplayValue('street2'));
    if (this.getSubFieldDisplayValue('city')) parts.push(this.getSubFieldDisplayValue('city'));
    if (this.getSubFieldDisplayValue('state')) parts.push(this.getSubFieldDisplayValue('state'));
    if (this.getSubFieldDisplayValue('postalCode')) parts.push(this.getSubFieldDisplayValue('postalCode'));
    if (this.getSubFieldDisplayValue('country')) parts.push(this.getSubFieldDisplayValue('country'));

    return parts.length > 0 ? parts.join(', ') : 'No address entered';
  }
}
