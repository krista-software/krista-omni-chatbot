import { Injectable } from '@angular/core';
import { FormField } from '../models/message.model';
import { FIELD_TYPES, FieldTypes } from '../config/field-types.constant';

/**
 * Service for field type detection and categorization
 * 
 * This service centralizes all field type checking logic that was previously
 * scattered across components (especially FormMessageComponent).
 * 
 * Benefits:
 * - Single source of truth for field type detection
 * - Reusable across components
 * - Easier to maintain and test
 * - Follows Single Responsibility Principle
 */
@Injectable({
  providedIn: 'root'
})
export class FieldTypeService {

  // ============================================================================
  // Text-based Field Types
  // ============================================================================

  /**
   * Check if field is a text input field (includes email, person, identifier, etc.)
   */
  isTextField(field: FormField): boolean {
    return field.fieldType === FieldTypes.TEXT_FIELD ||
           field.fieldType === FieldTypes.PARAGRAPH_FIELD ||
           field.fieldType === FieldTypes.EMAIL_FIELD ||
           field.fieldType === FieldTypes.PERSON_FIELD ||
           field.fieldType === FieldTypes.PROPER_NOUN_FIELD ||
           field.fieldType === FieldTypes.IDENTIFIER_FIELD ||
           // Individual address fields (not the compound Address field)
           field.fieldType === FieldTypes.STREET_FIELD ||
           field.fieldType === FieldTypes.STREET2_FIELD ||
           field.fieldType === FieldTypes.CITY_FIELD ||
           field.fieldType === FieldTypes.STATE_FIELD ||
           field.fieldType === FieldTypes.POSTAL_CODE_FIELD ||
           field.fieldType === FieldTypes.COUNTRY_FIELD;
  }

  /**
   * Check if field is a text-based field (paragraph, proper noun, person, identifier)
   */
  isTextBasedField(field: FormField): boolean {
    return field.fieldType === FieldTypes.PARAGRAPH_FIELD ||
           field.fieldType === FieldTypes.PROPER_NOUN_FIELD ||
           field.fieldType === FieldTypes.PERSON_FIELD ||
           field.fieldType === FieldTypes.IDENTIFIER_FIELD;
  }

  /**
   * Check if field is a phone field
   */
  isPhoneField(field: FormField): boolean {
    return field.fieldType === FieldTypes.PHONE_FIELD;
  }

  /**
   * Check if field is a rich text (WYSIWYG) field
   */
  isRichTextField(field: FormField): boolean {
    return field.fieldType === FieldTypes.RICH_TEXT_FIELD;
  }

  /**
   * Check if field is a label (display-only) field
   */
  isLabelField(field: FormField): boolean {
    return field.fieldType === FieldTypes.LABEL;
  }

  // ============================================================================
  // Numeric Field Types
  // ============================================================================

  /**
   * Check if field is a numeric field (number, currency, unit, percentage, double)
   */
  isNumberField(field: FormField): boolean {
    return field.fieldType === FieldTypes.NUMBER_FIELD ||
           field.fieldType === FieldTypes.CURRENCY_FIELD ||
           field.fieldType === FieldTypes.UNIT_FIELD ||
           field.fieldType === FieldTypes.PERCENTAGE_FIELD ||
           field.fieldType === FieldTypes.DOUBLE_FIELD;
  }

  /**
   * Check if field is a number-based field (Number, Currency, Unit) - excludes Percentage
   */
  isNumberBasedField(field: FormField): boolean {
    return field.fieldType === FIELD_TYPES.NUMBER ||
           field.fieldType === FIELD_TYPES.CURRENCY ||
           field.fieldType === FIELD_TYPES.UNIT;
  }

  /**
   * Check if field is a calculation field (read-only computed value)
   */
  isCalculationField(field: FormField): boolean {
    return field.fieldType === FieldTypes.CALCULATION_FIELD;
  }

  // ============================================================================
  // Date/Time Field Types
  // ============================================================================

  /**
   * Check if field is a date field
   */
  isDateField(field: FormField): boolean {
    return field.fieldType === FieldTypes.DATE_FIELD;
  }

  /**
   * Check if field is a date range field
   */
  isDateRangeField(field: FormField): boolean {
    return field.fieldType === FieldTypes.DATE_RANGE_FIELD;
  }

  /**
   * Check if field is a date-time range field
   */
  isDateTimeRangeField(field: FormField): boolean {
    return field.fieldType === FieldTypes.DATE_TIME_RANGE_FIELD;
  }

  /**
   * Check if field is a time field
   */
  isTimeField(field: FormField): boolean {
    return field.fieldType === FieldTypes.TIME_FIELD;
  }

  // ============================================================================
  // Address/Location Field Types
  // ============================================================================

  /**
   * Check if field is the compound Address field
   */
  isAddressCompoundField(field: FormField): boolean {
    return field.fieldType === FieldTypes.ADDRESS_FIELD;
  }

  /**
   * Check if field is any address-related field (individual or compound)
   */
  isAddressField(field: FormField): boolean {
    return field.fieldType === FieldTypes.STREET_FIELD ||
           field.fieldType === FieldTypes.STREET2_FIELD ||
           field.fieldType === FieldTypes.CITY_FIELD ||
           field.fieldType === FieldTypes.STATE_FIELD ||
           field.fieldType === FieldTypes.POSTAL_CODE_FIELD ||
           field.fieldType === FieldTypes.COUNTRY_FIELD ||
           field.fieldType === FieldTypes.ADDRESS_FIELD;
  }

  /**
   * Check if field is a location (GPS) field
   */
  isLocationField(field: FormField): boolean {
    return field.fieldType === FieldTypes.LOCATION_FIELD;
  }

  // ============================================================================
  // Selection Field Types
  // ============================================================================

  /**
   * Check if field is a pick-one (radio/dropdown) field
   */
  isPickOneField(field: FormField): boolean {
    return field.fieldType === FieldTypes.PICK_ONE_FIELD;
  }

  /**
   * Check if field is a checkboxes (multi-select) field
   */
  isCheckboxesField(field: FormField): boolean {
    return field.fieldType === FieldTypes.CHECKBOXES_FIELD;
  }

  // ============================================================================
  // Boolean/Toggle Field Types
  // ============================================================================

  /**
   * Check if field is a switch/boolean field
   */
  isSwitchField(field: FormField): boolean {
    return field.fieldType === FieldTypes.SWITCH_FIELD ||
           field.fieldType === FieldTypes.BOOLEAN_FIELD;
  }

  /**
   * Check if field is a rating field
   */
  isRatingField(field: FormField): boolean {
    return field.fieldType === FieldTypes.RATING_FIELD;
  }

  // ============================================================================
  // File/Media Field Types
  // ============================================================================

  /**
   * Check if field is a file upload field (includes camera)
   */
  isFileField(field: FormField): boolean {
    return field.fieldType === FieldTypes.FILE_FIELD ||
           field.fieldType === FieldTypes.CAMERA_FIELD;
  }

  /**
   * Check if field is a camera field
   */
  isCameraField(field: FormField): boolean {
    return field.fieldType === FieldTypes.CAMERA_FIELD;
  }

  // ============================================================================
  // Entity/Reference Field Types
  // ============================================================================

  /**
   * Check if field is an entity selection field
   */
  isEntitySelectionField(field: FormField): boolean {
    return field.fieldType === FieldTypes.ENTITY_SELECTION ||
           field.fieldType === FieldTypes.ENTITY_FIELD;
  }

  // ============================================================================
  // Container/Composite Field Types
  // ============================================================================

  /**
   * Check if field is a multi-field (composite/entity reference)
   */
  isMultiField(field: FormField): boolean {
    return field.fieldType === FieldTypes.MULTI_FIELD ||
           field.fieldType === FieldTypes.COMPOSITE_FIELD ||
           field.fieldType === FieldTypes.ENTITY_FIELD;
  }

  /**
   * Check if field is a table or list field
   */
  isTableOrListField(field: FormField): boolean {
    return field.fieldType === FieldTypes.TABLE_FIELD ||
           field.fieldType === FieldTypes.LIST_FIELD;
  }

  // ============================================================================
  // Special Field Types
  // ============================================================================

  /**
   * Check if field is a content stream field
   */
  isContentStreamField(field: FormField): boolean {
    return field.fieldType === FieldTypes.STREAM_FIELD;
  }

  // ============================================================================
  // Component Selection Helpers
  // ============================================================================

  /**
   * Check if field should use text-field component
   * Excludes number fields (they use number-field component)
   */
  usesTextFieldComponent(field: FormField): boolean {
    return this.isTextField(field) || this.isPhoneField(field);
  }

  /**
   * Check if field should bypass KristaField formatting
   * File, Camera, List, and Table fields handle their own formatting
   */
  isBypassField(field: FormField): boolean {
    return field.fieldType === FIELD_TYPES.FILE ||
           field.fieldType === FIELD_TYPES.CAMERA ||
           field.fieldType === FIELD_TYPES.LIST ||
           field.fieldType === FIELD_TYPES.TABLE;
  }

  /**
   * Check if a field type is supported by KristaField
   */
  isSupported(fieldType: string): boolean {
    return Object.values(FIELD_TYPES).includes(fieldType as typeof FIELD_TYPES[keyof typeof FIELD_TYPES]);
  }
}

