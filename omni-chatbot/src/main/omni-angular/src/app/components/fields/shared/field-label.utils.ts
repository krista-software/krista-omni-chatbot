/**
 * Shared utility functions for field labels
 * Centralizes label logic to follow DRY principle
 */

import { FormField } from '../../../models/message.model';

/**
 * Get field label with i18n support
 * Priority: displayLabel (from backend i18n) > displayName > name
 * 
 * @param field - The form field
 * @returns The label to display
 */
export function getFieldLabel(field: FormField): string {
  const fieldWithLabel = field as any;
  return fieldWithLabel.displayLabel || field.displayName || field.name;
}

/**
 * Get tooltip text from field attributes
 * 
 * @param field - The form field
 * @returns The tooltip text or empty string
 */
export function getFieldTooltip(field: FormField): string {
  return field.attributeValues?.['toolTip'] || '';
}

