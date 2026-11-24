import { FormField } from '../message.model';

/**
 * Base interface for field formatters
 * Each formatter implements field-specific formatting logic
 */
export interface FieldFormatter {
  /**
   * Format a value for display
   * @param value - The value to format
   * @param field - The field configuration
   * @returns Formatted string value
   */
  format(value: any, field: FormField): string;

  /**
   * Format a value when field loses focus (blur event)
   * This is typically used for more aggressive formatting like:
   * - Adding symbols (%, $)
   * - Capitalizing text
   * - Formatting phone numbers
   * @param value - The value to format
   * @param field - The field configuration
   * @returns Formatted value (can be string or original type)
   */
  formatOnBlur(value: any, field: FormField): any;
}

