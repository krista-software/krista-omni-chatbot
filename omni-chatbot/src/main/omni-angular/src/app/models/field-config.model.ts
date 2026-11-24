/**
 * Configuration object for field components
 * This consolidates common field properties into a single config object
 * to reduce the number of @Input() properties needed in field components
 */
export interface FieldConfig {
  // Display and formatting
  displayValue?: string;
  inputType?: string;
  placeholder?: string;

  // Validation and error state
  hasError?: boolean;
  errorMessage?: string;

  // State
  readOnly?: boolean;
  showLabel?: boolean; // Whether to show the field label (default: true)
  hideRequiredIndicator?: boolean; // Hide the required asterisk (e.g., for Inform messages)

  // Additional properties for specific field types
  rows?: number; // For textarea fields
  allowMapSelection?: boolean; // For location fields
  workspaceId?: string; // For file fields
  clientSessionId?: string; // For file fields
}

/**
 * Configuration for text-based fields
 */
export interface TextFieldConfig extends FieldConfig {
  displayValue: string;
  inputType: string;
  hasError: boolean;
  errorMessage: string;
  readOnly: boolean;
}

/**
 * Configuration for address field sub-fields
 */
export interface AddressFieldConfig extends FieldConfig {
  streetDisplayValue?: string;
  street2DisplayValue?: string;
  cityDisplayValue?: string;
  stateDisplayValue?: string;
  countryDisplayValue?: string;
  postalCodeDisplayValue?: string;
  hasError: boolean;
  errorMessage: string;
  readOnly: boolean;
}

/**
 * Configuration for location fields
 */
export interface LocationFieldConfig extends FieldConfig {
  displayValue: string;
  allowMapSelection: boolean;
  hasError: boolean;
  errorMessage: string;
  readOnly: boolean;
}

/**
 * Configuration for file fields
 */
export interface FileFieldConfig extends FieldConfig {
  workspaceId: string;
  clientSessionId: string;
  hasError: boolean;
  errorMessage: string;
  readOnly: boolean;
}

/**
 * Configuration for basic fields (date, time, switch, rating, pick-one, pick-many, etc.)
 */
export interface BasicFieldConfig extends FieldConfig {
  hasError: boolean;
  errorMessage: string;
  readOnly: boolean;
}

/**
 * Configuration for rich text fields (WYSIWYG editor)
 */
export interface RichTextFieldConfig extends FieldConfig {
  displayValue: string;
  hasError: boolean;
  errorMessage: string;
  readOnly: boolean;
  maxLineCount?: number; // Maximum number of lines to display
  compact?: boolean; // Whether to use compact mode (for table cells)
}

