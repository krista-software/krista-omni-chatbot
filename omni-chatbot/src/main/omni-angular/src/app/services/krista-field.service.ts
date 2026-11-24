import { Injectable } from '@angular/core';
import { KristaFieldFactory } from '@krista/field-types/core';
import { parsePhoneNumber } from 'libphonenumber-js';
import {
  RequiredValidator,
  EmailValidator,
  PhoneValidator,
  TextLengthValidator,
  NumericRangeValidator,
  PatternValidator,
  PickManyValidator,
  DateValidator,
  TimeValidator,
  DateRangeValidator,
  DateTimeRangeValidator,
  RatingValidator,
  FileValidator
} from '../models/validators/base-validators';

// Define a flexible FormField type that accepts both app and toolkit formats
interface FlexibleFormField {
  fieldId?: string;
  name: string;
  fieldType: string;
  value?: unknown;
  required?: boolean;
  readOnly?: boolean;
  attributeValues?: Record<string, unknown>;
  options?: Record<string, unknown>;
  label?: string;
}

/**
 * Krista field instance from the library
 * Uses 'any' for setValue since the library accepts various value types
 */
interface KristaField {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setValue: (value: any) => void;
  validate: () => boolean;
  getErrors?: () => string[];
  toResponse?: () => unknown;
  formattedValue?: string;
}

/**
 * Validation result
 */
interface ValidationResult {
  isValid: boolean;
  errorMessage?: string;
}

/**
 * Filter configuration from attributeValues
 */
interface FilterConfig {
  field?: {
    fieldType?: string | { type?: string; name?: string };
    [key: string]: unknown;
  };
  fieldName?: string;
  timeout?: number;
}

/**
 * Meta configuration for Table fields
 */
interface MetaConfig {
  entity?: {
    attributeValues?: Record<string, unknown>;
    attributes?: Map<string, unknown>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Date range value structure
 */
interface DateRangeValue {
  from?: number | string;
  to?: number | string;
}

/**
 * Phone value structure
 */
interface PhoneValue {
  countryCode: number;
  nationalNumber: number;
}

/**
 * Service to integrate @krista/field-types library with Angular components
 * This service provides field validation, formatting, and value handling
 * using the Krista field types library
 */
@Injectable({
  providedIn: 'root'
})
export class KristaFieldService {

  constructor() {}

  /**
   * Convert full field type name to short name expected by @krista/field-types library
   * @param fieldType Full field type (e.g., "com.krista.fields.Date")
   * @returns Short field type (e.g., "Date")
   */
  private convertFieldType(fieldType: string): string {
    // If already in short format, return as-is
    if (!fieldType.includes('.')) {
      return fieldType;
    }

    // Extract the short name from the full name
    // "com.krista.fields.Date" -> "Date"
    const parts = fieldType.split('.');
    return parts[parts.length - 1];
  }

  /**
   * Sanitize filters array to ensure field.fieldType is always a string
   * The @krista/field-types library expects fieldType to be a string
   * @param filters The filters array from attributeValues
   * @returns Sanitized filters array
   */
  private sanitizeFilters(filters: FilterConfig[]): FilterConfig[] {
    return filters.map((filter: FilterConfig) => {
      if (!filter) return filter;

      // If filter has a field property, ensure fieldType is a string
      if (filter.field) {
        const sanitizedField = { ...filter.field };

        // Ensure fieldType is a string
        if (sanitizedField.fieldType && typeof sanitizedField.fieldType !== 'string') {
          // If fieldType is an object, try to extract the type string
          const fieldTypeObj = sanitizedField.fieldType as { type?: string; name?: string };
          sanitizedField.fieldType = fieldTypeObj.type || fieldTypeObj.name || 'com.krista.fields.Text';
        }

        // If fieldType is missing, default to Text
        if (!sanitizedField.fieldType) {
          sanitizedField.fieldType = 'com.krista.fields.Text';
        }

        return { ...filter, field: sanitizedField };
      }

      return filter;
    });
  }

  /**
   * Create a Krista field instance from a FormField
   * @param formField The form field definition (accepts both app and toolkit FormField types)
   * @returns Krista field instance with validation and formatting capabilities
   */
  createField(formField: FlexibleFormField): KristaField | null {
    try {
      // Skip creating fields for Date, DateRange, and DateTimeRange to avoid moment.js bundling issues
      // These field types are handled directly in getKristaValue()
      const fieldType = formField.fieldType;
      if (fieldType === 'com.krista.fields.Date' ||
          fieldType === 'com.krista.fields.DateRange' ||
          fieldType === 'com.krista.fields.DateTimeRange') {
        return null;
      }

      // Convert attributeValues object to Map
      const attributeMap = new Map<string, unknown>();
      if (formField.attributeValues) {
        Object.entries(formField.attributeValues).forEach(([key, value]) => {
          // Sanitize filters to ensure field.fieldType is always a string
          if (key === 'filters' && Array.isArray(value)) {
            const sanitizedFilters = this.sanitizeFilters(value as FilterConfig[]);
            attributeMap.set(key, sanitizedFilters);
          } else if (key === 'meta' && value && typeof value === 'object') {
            // For Table fields, convert meta.entity.attributeValues to attributes (Map)
            const meta = { ...(value as MetaConfig) };

            if (meta.entity) {
              // Entity exists - convert attributeValues to attributes Map
              const entityAttributesMap = new Map<string, unknown>();
              if (meta.entity.attributeValues) {
                Object.entries(meta.entity.attributeValues).forEach(([k, v]) => {
                  entityAttributesMap.set(k, v);
                });
              }
              meta.entity = {
                ...meta.entity,
                attributes: entityAttributesMap
              };
            } else {
              // No entity - create a minimal entity with empty attributes
              meta.entity = {
                name: 'Entity',
                fieldType: 'com.krista.fields.Entity',
                attributes: new Map<string, unknown>()
              };
            }
            attributeMap.set(key, meta);
          } else if (key === 'entityDefinition' && value && typeof value === 'object') {
            // For EntityReference fields, convert entityDefinition.fields from object to array
            // original EntityDefinition.fromJSON does: Object.values(json["fields"])
            // The toolkit's BaseCompositeField.createSubfields expects an array for .forEach()
            const entityDef = { ...(value as any) };
            if (entityDef.fields && !Array.isArray(entityDef.fields)) {
              entityDef.fields = Object.values(entityDef.fields);
            }
            attributeMap.set(key, entityDef);
          } else {
            attributeMap.set(key, value);
          }
        });
      }

      // Convert field type from full name to short name
      const shortFieldType = this.convertFieldType(formField.fieldType);

      // For percentage fields, convert the value from percentage (30) to decimal (0.3)
      // before passing to the toolkit (matches original app behavior)
      let fieldValue = formField.value;
      if (formField.fieldType === 'com.krista.fields.Percentage' && fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
        const stringValue = String(fieldValue).replace('%', '');
        const numericValue = Number(stringValue);
        if (!isNaN(numericValue)) {
          fieldValue = numericValue / 100; // Convert to decimal (30 -> 0.3)
        }
      }

      // Create field using KristaFieldFactory
      // Use fieldId if available (toolkit FormField), otherwise use name (app FormField)
      const fieldId = formField.fieldId || formField.name;
      // Cast fieldValue to any since KristaFieldFactory accepts various value types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const field = KristaFieldFactory.create(
        shortFieldType,
        fieldId,
        attributeMap,
        fieldValue as any
      );

      return field as unknown as KristaField;
    } catch (error) {
      console.error('Error creating Krista field:', error);
      return null;
    }
  }

  /**
   * Get formatted value from a field
   * @param formField The form field (accepts both app and toolkit FormField types)
   * @param value The raw value
   * @returns Formatted value string
   */
  getFormattedValue(formField: FlexibleFormField, value: unknown): string {
    const field = this.createField(formField);
    if (!field) {
      return value != null ? String(value) : '';
    }

    try {
      field.setValue(value);
      return field.formattedValue || (value != null ? String(value) : '');
    } catch {
      return value != null ? String(value) : '';
    }
  }

  /**
   * Validate a field value using @krista/field-types validators
   * @param formField The form field (accepts both app and toolkit FormField types)
   * @param value The value to validate
   * @returns Validation result with isValid flag and error message
   */
  validateField(formField: FlexibleFormField, value: unknown): ValidationResult {
    // Get validators for this field type
    const validators = this.getValidatorsForField(formField);

    // Run all validators
    for (const validator of validators) {
      const result = validator.validate(value, formField as any);
      if (!result.isValid) {
        return result;
      }
    }

    return { isValid: true };
  }

  /**
   * Get validators for a field based on its type and attributes
   * @param formField The form field
   * @returns Array of validators to run
   */
  private getValidatorsForField(formField: FlexibleFormField): any[] {
    const validators: any[] = [];

    // Always add required validator first
    validators.push(new RequiredValidator());

    // Add field-type-specific validators
    switch (formField.fieldType) {
      case 'com.krista.fields.Email':
        validators.push(new EmailValidator());
        break;

      case 'com.krista.fields.Phone':
        validators.push(new PhoneValidator());
        break;

      case 'com.krista.fields.Text':
      case 'com.krista.fields.RichText':
        validators.push(new TextLengthValidator());
        if (formField.attributeValues?.['pattern']) {
          validators.push(new PatternValidator());
        }
        break;

      case 'com.krista.fields.Number':
      case 'com.krista.fields.Currency':
      case 'com.krista.fields.Percentage':
        validators.push(new NumericRangeValidator());
        break;

      case 'com.krista.fields.PickMany':
        validators.push(new PickManyValidator());
        break;

      case 'com.krista.fields.Date':
        validators.push(new DateValidator());
        break;

      case 'com.krista.fields.Time':
        validators.push(new TimeValidator());
        break;

      case 'com.krista.fields.DateRange':
        validators.push(new DateRangeValidator());
        break;

      case 'com.krista.fields.DateTimeRange':
        validators.push(new DateTimeRangeValidator());
        break;

      case 'com.krista.fields.Rating':
        validators.push(new RatingValidator());
        break;

      case 'com.krista.fields.File':
        validators.push(new FileValidator());
        break;
    }

    return validators;
  }

  /**
   * Get Krista value from a field (for submission)
   * This method converts the field value to the proper Krista backend schema format
   * by calling the field's toResponse() method which returns submission-ready JSON
   * @param formField The form field (accepts both app and toolkit FormField types)
   * @param value The current value
   * @returns Krista value object ready for submission (properly formatted JSON)
   */
  getKristaValue(formField: FlexibleFormField, value: unknown): unknown {
    // For File and Camera fields, return the value directly without processing
    // These fields handle their own upload and metadata formatting
    const fieldType = formField.fieldType;
    if (fieldType === 'com.krista.fields.File' || fieldType === 'com.krista.fields.Camera') {
      return value;
    }

    // Handle Date, DateRange, and DateTimeRange fields directly to avoid moment.js bundling issues
    // The @krista/field-types library has ESM/CommonJS interop issues with moment-timezone
    if (fieldType === 'com.krista.fields.Date') {
      return this.processDateValue(formField, value);
    }

    if (fieldType === 'com.krista.fields.DateRange') {
      return this.processDateRangeValue(formField, value);
    }

    if (fieldType === 'com.krista.fields.DateTimeRange') {
      return this.processDateTimeRangeValue(formField, value);
    }

    // Special handling for Table fields - bypass toolkit processing
    // The table-field component already formats the value correctly for submission
    // The value structure is: { headers: [], footers: [], rows: [], deletedRows: [] }
    // This matches the original implementation which returns the value directly
    if (fieldType === 'com.krista.fields.Table') {
      return value;
    }

    // EntityReference fields are handled by transformEntityReferenceValue() in form-message
    // which builds meta and transforms sub-field values. Bypass toolkit processing here
    // to avoid the toolkit's toResponse() dropping nested MultiField values.
    if (fieldType === 'com.krista.fields.EntityReference') {
      return value;
    }

    // MultiField/Composite fields: bypass toolkit processing to avoid the toolkit's
    // toResponse() dropping values for nested MultiFields (MultiField inside MultiField).
    // Instead, manually iterate sub-fields and recursively convert each value.
    // This matches original's CompositeValue.toResponse() which recursively serializes.
    if (fieldType === 'com.krista.fields.MultiField' || fieldType === 'com.krista.fields.Composite') {
      return this.processMultiFieldValue(formField, value);
    }

    // Pre-process Date and Time fields to convert string values to timestamps
    // This handles cases where date/time values are stored as strings (e.g., "2025-11-19", "13:54")
    // instead of timestamps, which the toolkit expects
    let processedValue = this.preprocessDateTimeValue(formField, value);

    // Pre-process Phone fields to convert string values to phone objects
    // This handles cases where phone values are stored as strings (e.g., "8989942017")
    // instead of phone objects with countryCode and nationalNumber
    processedValue = this.preprocessPhoneValue(formField, processedValue);

    // Special handling for List fields - bypass toolkit processing
    // The toolkit's List field implementation in @krista/field-types has issues
    // For all list fields (simple and entity), return the array as-is.
    // Entity list items are already transformed with meta by form-message's onSubmitForm().
    if (fieldType === 'com.krista.fields.List') {
      return processedValue;
    }

    const field = this.createField(formField);
    if (!field) {
      return processedValue;
    }

    // Handle null/undefined values - return as-is without processing
    if (processedValue === null || processedValue === undefined) {
      return processedValue;
    }

    try {
      field.setValue(processedValue);

      // Use toResponse() instead of getKristaValue() to get submission-ready JSON
      // toResponse() calls the KristaValue's toResponse() method which formats the value
      // according to the backend schema (e.g., DateRangeValue adds "type" field)
      return field.toResponse ? field.toResponse() : processedValue;
    } catch (error) {
      console.error('Error getting Krista value:', error);
      return processedValue;
    }
  }

  /**
   * Process MultiField/Composite value for submission.
   * Recursively iterates sub-fields and converts each value via getKristaValue().
   * This matches original's CompositeValue.toResponse() which recursively calls
   * toResponse() on each sub-field's KristaValue.
   */
  private processMultiFieldValue(formField: FlexibleFormField, value: unknown): unknown {
    if (!value || typeof value !== 'object') {
      return value;
    }

    const subFieldsJson = formField.attributeValues?.['fields'] as any[] | undefined;
    if (!subFieldsJson || !Array.isArray(subFieldsJson)) {
      // No sub-field definitions available — return as-is
      return value;
    }

    const valueObj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    subFieldsJson.forEach((subFieldDef: any) => {
      const subFieldName = subFieldDef.name;
      const subFieldValue = valueObj[subFieldName];

      // Create a temporary FormField for the sub-field so getKristaValue() can
      // apply the correct type-specific conversion (Phone→object, Percentage→decimal, etc.)
      const tempField: FlexibleFormField = {
        fieldId: `${formField.fieldId || formField.name}.${subFieldName}`,
        name: `${formField.name}.${subFieldName}`,
        fieldType: subFieldDef.fieldType,
        value: subFieldValue,
        attributeValues: subFieldDef.attributeValues || {},
        options: subFieldDef.options || {}
      };

      // Recursively convert — nested MultiField will hit the same MultiField branch
      result[subFieldName] = this.getKristaValue(tempField, subFieldValue);
    });

    return result;
  }

  /**
   * Process DateRange field value for submission
   * Handles the conversion directly to avoid moment.js bundling issues in @krista/field-types
   * @param _formField The form field (unused but kept for consistency)
   * @param value The current value (expected format: { from: number, to: number })
   * @returns Processed value ready for submission
   */
  private processDateRangeValue(_formField: FlexibleFormField, value: unknown): unknown {
    const dateRangeValue = value as DateRangeValue | null | undefined;
    if (!dateRangeValue || (dateRangeValue.from === undefined && dateRangeValue.to === undefined)) {
      return undefined;
    }

    try {
      const fromTimestamp = dateRangeValue.from ? Number(dateRangeValue.from) : undefined;
      const toTimestamp = dateRangeValue.to ? Number(dateRangeValue.to) : undefined;

      if (fromTimestamp === undefined || toTimestamp === undefined) {
        return undefined;
      }

      // Convert to start of day in UTC (matching the library's behavior)
      const fromDate = new Date(fromTimestamp);
      fromDate.setUTCHours(0, 0, 0, 0);

      const toDate = new Date(toTimestamp);
      toDate.setUTCHours(0, 0, 0, 0);

      // Return in the format expected by the backend
      // Use full qualified type name as expected by Krista backend
      return {
        type: 'com.krista.net.model.fieldschemas.DateRange',
        from: fromDate.getTime(),
        to: toDate.getTime()
      };
    } catch (error) {
      console.error('Error processing DateRange value:', error);
      return value;
    }
  }

  /**
   * Process DateTimeRange field value for submission
   * Handles the conversion directly to avoid moment.js bundling issues in @krista/field-types
   * @param formField The form field
   * @param value The current value (expected format: { from: number, to: number })
   * @returns Processed value ready for submission
   */
  private processDateTimeRangeValue(formField: FlexibleFormField, value: any): any {
    if (!value || (value.from === undefined && value.to === undefined)) {
      return undefined;
    }

    try {
      const fromTimestamp = value.from ? Number(value.from) : undefined;
      const toTimestamp = value.to ? Number(value.to) : undefined;

      if (fromTimestamp === undefined || toTimestamp === undefined) {
        return undefined;
      }

      // Return in the format expected by the backend (keep full timestamp for datetime)
      // Use full qualified type name as expected by Krista backend
      return {
        type: 'com.krista.net.model.fieldschemas.DateRange',
        from: fromTimestamp,
        to: toTimestamp
      };
    } catch (error) {
      console.error('Error processing DateTimeRange value:', error);
      return value;
    }
  }

  /**
   * Process Date field value for submission
   * Handles the conversion directly to avoid moment.js bundling issues in @krista/field-types
   * @param formField The form field
   * @param value The current value (expected format: number timestamp or string date)
   * @returns Processed value ready for submission (timestamp in UTC start of day)
   */
  private processDateValue(formField: FlexibleFormField, value: any): any {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    try {
      let timestamp: number;

      // Handle string date values (e.g., "2025-11-19")
      if (typeof value === 'string') {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          return undefined;
        }
        timestamp = date.getTime();
      } else {
        timestamp = Number(value);
      }

      if (isNaN(timestamp)) {
        return undefined;
      }

      // Convert to start of day in UTC (matching the library's behavior)
      const date = new Date(timestamp);
      date.setUTCHours(0, 0, 0, 0);

      return date.getTime();
    } catch (error) {
      console.error('Error processing Date value:', error);
      return value;
    }
  }

  /**
   * Pre-process date and time values to convert strings to timestamps
   * The toolkit expects Date and Time fields to have numeric timestamp values
   * @param formField The form field
   * @param value The current value
   * @returns Processed value (timestamp for Date/Time fields, original value otherwise)
   */
  private preprocessDateTimeValue(formField: FlexibleFormField, value: any): any {
    if (!value) {
      return value;
    }

    const fieldType = formField.fieldType;

    // Handle Date field: Convert "YYYY-MM-DD" string to timestamp
    if (fieldType === 'com.krista.fields.Date') {
      if (typeof value === 'string') {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          // Strip time component (set to midnight) to match original app behavior
          date.setHours(0, 0, 0, 0);
          return date.getTime();
        }
      }
      // If already a number (timestamp), return as is
      return value;
    }

    // Handle Time field: Convert "HH:MM" string to timestamp
    if (fieldType === 'com.krista.fields.Time') {
      if (typeof value === 'string') {
        // Check if it's in HH:MM or HH:MM:SS format
        const timeMatch = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          const date = new Date();
          date.setHours(hours, minutes, 0, 0);
          return date.getTime();
        }
      }
      // If already a number (timestamp), return as is
      return value;
    }

    // For all other field types, return value as is
    return value;
  }

  /**
   * Pre-process phone values to convert strings to phone objects
   * The toolkit expects Phone fields to have phone objects with countryCode and nationalNumber
   * Matches original app's PhoneFieldRenderer behavior (lines 51-80)
   * @param formField The form field
   * @param value The current value
   * @returns Processed value (phone object for Phone fields, original value otherwise)
   */
  private preprocessPhoneValue(formField: FlexibleFormField, value: any): any {
    if (!value) {
      return value;
    }

    const fieldType = formField.fieldType;

    // Handle Phone field: Convert string to phone object
    if (fieldType === 'com.krista.fields.Phone') {
      // If already a phone object with countryCode and nationalNumber, return as is
      if (typeof value === 'object' && 'countryCode' in value && 'nationalNumber' in value) {
        return value;
      }

      // If it's a string, convert to phone object
      if (typeof value === 'string') {
        const stringValue = value.trim();
        if (!stringValue) {
          return undefined;
        }

        try {
          // Try to parse the phone number with libphonenumber-js
          const phoneNumber = parsePhoneNumber(stringValue);
          if (phoneNumber && phoneNumber.isValid()) {
            // Successfully parsed - return phone object
            return {
              countryCode: parseInt(phoneNumber.countryCallingCode, 10),
              nationalNumber: parseInt(phoneNumber.nationalNumber, 10)
            };
          }
        } catch (error) {
          // Parsing failed - fall through to fallback logic
        }

        // Fallback: If parsing fails, extract numbers and use countryCode = 0
        // This matches original app behavior (PhoneFieldRenderer.tsx lines 68-78)
        const numbersOnly = stringValue.replace(/\D/g, '');
        const numberValue = parseInt(numbersOnly, 10);

        if (!isNaN(numberValue)) {
          return {
            countryCode: 0,
            nationalNumber: numberValue
          };
        }

        // If we can't extract a valid number, return undefined
        return undefined;
      }
    }

    // For all other field types, return value as is
    return value;
  }

  /**
   * Format value on blur (for text fields)
   * @param formField The form field (accepts both app and toolkit FormField types)
   * @param value The value to format
   * @returns Formatted value
   */
  formatOnBlur(formField: FlexibleFormField, value: any): any {
    return this.getFormattedValue(formField, value);
  }

  /**
   * Check if a field type is supported by the library
   * @param fieldType The field type string
   * @returns True if supported
   */
  isFieldTypeSupported(fieldType: string): boolean {
    const supportedTypes = [
      'com.krista.fields.Text',
      'com.krista.fields.Phone',
      'com.krista.fields.Email',
      'com.krista.fields.Number',
      'com.krista.fields.Percentage',
      'com.krista.fields.Currency',
      'com.krista.fields.Date',
      'com.krista.fields.Time',
      'com.krista.fields.DateTime',
      'com.krista.fields.DateRange',
      'com.krista.fields.DateTimeRange',
      'com.krista.fields.Location',
      'com.krista.fields.Address',
      'com.krista.fields.PickOne',
      'com.krista.fields.PickMany',
      'com.krista.fields.Switch',
      'com.krista.fields.Rating',
      'com.krista.fields.File',
      'com.krista.fields.Camera',
      'com.krista.fields.ProperNoun',
      'com.krista.fields.Person',
      'com.krista.fields.Identifier',
      'com.krista.fields.Street',
      'com.krista.fields.Street2',
      'com.krista.fields.City',
      'com.krista.fields.State',
      'com.krista.fields.Country',
      'com.krista.fields.PostalCode',
      'com.krista.fields.Unit'
    ];

    return supportedTypes.includes(fieldType);
  }
}

