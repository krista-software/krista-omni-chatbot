import { FieldValidator, ValidationResult, VALIDATION_MESSAGES } from './field-validator.interface';
import { FormField } from '../message.model';
import { parsePhoneNumber } from 'libphonenumber-js';
import { validateFile } from '../../utils/file-validation.util';

/**
 * Required field validator
 * Validates that a field has a non-empty value
 */
export class RequiredValidator implements FieldValidator {
  validate(value: any, field: FormField): ValidationResult {
    // Check if field is required
    if (!field.required) {
      return { isValid: true };
    }

    // Check for empty values
    if (value === undefined || value === null || value === '') {
      return {
        isValid: false,
        errorMessage: VALIDATION_MESSAGES.required
      };
    }

    // For arrays (pick-many fields)
    if (Array.isArray(value) && value.length === 0) {
      return {
        isValid: false,
        errorMessage: VALIDATION_MESSAGES.required
      };
    }

    // For objects (address, location fields)
    if (typeof value === 'object' && !Array.isArray(value)) {
      const hasValue = Object.values(value).some(v => v !== undefined && v !== null && v !== '');
      if (!hasValue) {
        return {
          isValid: false,
          errorMessage: VALIDATION_MESSAGES.required
        };
      }
    }

    return { isValid: true };
  }
}

/**
 * Email validator
 * Validates email format and allowed domains
 */
export class EmailValidator implements FieldValidator {
  private emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  validate(value: any, field: FormField): ValidationResult {
    const stringValue = value?.toString().trim();
    
    // Empty values are handled by RequiredValidator
    if (!stringValue) {
      return { isValid: true };
    }

    // Check email format
    if (!this.emailRegex.test(stringValue)) {
      return {
        isValid: false,
        errorMessage: VALIDATION_MESSAGES.invalidEmail
      };
    }

    // Check allowed domains if specified
    const allowedDomains = field.attributeValues?.['allowedDomains'];
    if (allowedDomains && Array.isArray(allowedDomains)) {
      const domain = stringValue.split('@')[1];
      if (!allowedDomains.includes(domain)) {
        return {
          isValid: false,
          errorMessage: VALIDATION_MESSAGES.allowedEmailDomains(allowedDomains.join(', '))
        };
      }
    }

    return { isValid: true };
  }
}

/**
 * Phone number validator
 * Validates phone number format using libphonenumber-js
 * Matches original app's PhoneNumberValidator behavior
 */
export class PhoneValidator implements FieldValidator {
  validate(value: any, field: FormField): ValidationResult {
    // Empty values are handled by RequiredValidator
    if (!value) {
      return { isValid: true };
    }

    // Convert phone value to string for validation
    let stringValue: string;

    // Handle phone object format: {countryCode: number, nationalNumber: number}
    if (typeof value === 'object' && 'countryCode' in value && 'nationalNumber' in value) {
      const countryCode = value.countryCode;
      const nationalNumber = value.nationalNumber;

      // If countryCode is 0 or not set, use just the national number
      if (!countryCode || countryCode === 0) {
        stringValue = nationalNumber.toString();
      } else {
        // Format as international: +918989942017
        stringValue = `+${countryCode}${nationalNumber}`;
      }
    } else {
      // Handle string values
      stringValue = value.toString().trim();
    }

    if (!stringValue) {
      return { isValid: true };
    }

    try {
      // Try to parse the phone number using libphonenumber-js
      const phoneNumber = parsePhoneNumber(stringValue);

      // Check if the parsed phone number is valid
      // For numbers with countryCode = 0 (local numbers), skip validation
      // This matches original app behavior where local numbers are accepted
      if (typeof value === 'object' && value.countryCode === 0) {
        // Local number - just check that we have a valid national number
        const numbersOnly = stringValue.replace(/\D/g, '');
        if (numbersOnly.length < 10) {
          return {
            isValid: false,
            errorMessage: VALIDATION_MESSAGES.invalidPhoneNumber
          };
        }
        return { isValid: true };
      }

      if (!phoneNumber || !phoneNumber.isValid()) {
        return {
          isValid: false,
          errorMessage: VALIDATION_MESSAGES.invalidPhoneNumber
        };
      }

      return { isValid: true };
    } catch (error) {
      // If parsing fails, try to extract numbers and validate basic format
      const numbersOnly = stringValue.replace(/\D/g, '');

      // Must have at least 10 digits for a valid phone number
      if (numbersOnly.length < 10) {
        return {
          isValid: false,
          errorMessage: VALIDATION_MESSAGES.invalidPhoneNumber
        };
      }

      // If we have numbers but parsing failed, it might still be a valid local number
      return { isValid: true };
    }
  }
}

/**
 * Text length validator
 * Validates minimum and maximum text length
 */
export class TextLengthValidator implements FieldValidator {
  validate(value: any, field: FormField): ValidationResult {
    const stringValue = value?.toString() || '';
    
    // Empty values are handled by RequiredValidator
    if (!stringValue) {
      return { isValid: true };
    }

    const minLength = field.attributeValues?.['minLength'];
    const maxLength = field.attributeValues?.['maxLength'];

    if (minLength !== undefined && stringValue.length < minLength) {
      return {
        isValid: false,
        errorMessage: VALIDATION_MESSAGES.minLength(minLength)
      };
    }

    if (maxLength !== undefined && stringValue.length > maxLength) {
      return {
        isValid: false,
        errorMessage: VALIDATION_MESSAGES.maxLength(maxLength)
      };
    }

    return { isValid: true };
  }
}

/**
 * Numeric range validator
 * Validates minimum and maximum numeric values
 */
export class NumericRangeValidator implements FieldValidator {
  validate(value: any, field: FormField): ValidationResult {
    const stringValue = value?.toString().trim();

    // Empty values are handled by RequiredValidator
    if (!stringValue) {
      return { isValid: true };
    }

    // Remove % sign for percentage fields
    const cleanValue = stringValue.replace('%', '');
    let numericValue = parseFloat(cleanValue);

    if (isNaN(numericValue)) {
      return {
        isValid: false,
        errorMessage: VALIDATION_MESSAGES.enterCorrectValues
      };
    }

    let minValue = field.attributeValues?.['minValue'];
    let maxValue = field.attributeValues?.['maxValue'];

    // For percentage fields, backend sends minValue/maxValue in decimal format (0-1)
    // but we store values in percentage format (0-100)
    // So we need to convert backend min/max to percentage for comparison
    const isPercentageField = field.fieldType === 'com.krista.fields.Percentage';
    if (isPercentageField) {
      if (minValue !== undefined) {
        minValue = minValue * 100; // Convert decimal to percentage (0.01 -> 1)
      }
      if (maxValue !== undefined) {
        maxValue = maxValue * 100; // Convert decimal to percentage (1 -> 100)
      }
    }

    if (minValue !== undefined && numericValue < minValue) {
      return {
        isValid: false,
        errorMessage: VALIDATION_MESSAGES.minValue(minValue)
      };
    }

    if (maxValue !== undefined && numericValue > maxValue) {
      return {
        isValid: false,
        errorMessage: VALIDATION_MESSAGES.maxValue(maxValue)
      };
    }

    return { isValid: true };
  }
}

/**
 * Pattern validator
 * Validates value against a regex pattern
 */
export class PatternValidator implements FieldValidator {
  validate(value: any, field: FormField): ValidationResult {
    const stringValue = value?.toString().trim();
    
    // Empty values are handled by RequiredValidator
    if (!stringValue) {
      return { isValid: true };
    }

    const pattern = field.attributeValues?.['pattern'];
    if (!pattern) {
      return { isValid: true };
    }

    try {
      const regex = new RegExp(pattern);
      if (!regex.test(stringValue)) {
        return {
          isValid: false,
          errorMessage: VALIDATION_MESSAGES.pattern(pattern)
        };
      }
    } catch (error) {
      console.error('Invalid regex pattern:', pattern, error);
      return { isValid: true }; // Don't fail validation if pattern is invalid
    }

    return { isValid: true };
  }
}

/**
 * Pick many validator
 * Validates minimum and maximum selection count for multi-select fields
 */
export class PickManyValidator implements FieldValidator {
  validate(value: any, field: FormField): ValidationResult {
    const values = Array.isArray(value) ? value : [];
    
    const minSelection = field.attributeValues?.['minSelection'];
    const maxSelection = field.attributeValues?.['maxSelection'];

    if (minSelection !== undefined && values.length < minSelection) {
      return {
        isValid: false,
        errorMessage: VALIDATION_MESSAGES.minSelection(minSelection)
      };
    }

    if (maxSelection !== undefined && values.length > maxSelection) {
      return {
        isValid: false,
        errorMessage: VALIDATION_MESSAGES.maxSelection(maxSelection)
      };
    }

    return { isValid: true };
  }
}

/**
 * Validator for Date fields
 * Validates date format and min/max date constraints
 */
export class DateValidator implements FieldValidator {
  validate(value: any, field: FormField): ValidationResult {
    // Not required and empty - valid
    if (!field.required && !value) {
      return { isValid: true };
    }

    // Required and empty - invalid
    if (field.required && !value) {
      return { isValid: false, errorMessage: 'Please select a date' };
    }

    // Validate date format (timestamp or valid date string)
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return { isValid: false, errorMessage: 'Please enter a valid date' };
    }

    // Check min date
    const minDate = field.attributeValues?.['minDate'];
    if (minDate) {
      const min = new Date(minDate);
      if (!isNaN(min.getTime()) && date < min) {
        return { isValid: false, errorMessage: `Date must be on or after ${min.toLocaleDateString()}` };
      }
    }

    // Check max date
    const maxDate = field.attributeValues?.['maxDate'];
    if (maxDate) {
      const max = new Date(maxDate);
      if (!isNaN(max.getTime()) && date > max) {
        return { isValid: false, errorMessage: `Date must be on or before ${max.toLocaleDateString()}` };
      }
    }

    return { isValid: true };
  }
}

/**
 * Validator for Time fields
 * Validates time format
 */
export class TimeValidator implements FieldValidator {
  validate(value: any, field: FormField): ValidationResult {
    // Not required and empty - valid
    if (!field.required && !value) {
      return { isValid: true };
    }

    // Required and empty - invalid
    if (field.required && !value) {
      return { isValid: false, errorMessage: 'Please enter a time' };
    }

    // Validate time format (timestamp or HH:MM string)
    if (typeof value === 'number') {
      // Timestamp - valid
      return { isValid: true };
    }

    if (typeof value === 'string') {
      // Check HH:MM format
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(value)) {
        return { isValid: false, errorMessage: 'Please enter a valid time (HH:MM)' };
      }
    }

    return { isValid: true };
  }
}

/**
 * Validator for DateRange fields
 * Validates that start date is before end date
 */
export class DateRangeValidator implements FieldValidator {
  validate(value: any, field: FormField): ValidationResult {
    // Not required and empty - valid
    if (!field.required && !value) {
      return { isValid: true };
    }

    // Required and empty - invalid
    if (field.required && !value) {
      return { isValid: false, errorMessage: 'Please select a date range' };
    }

    // Check if value is an object with from/to properties
    if (typeof value !== 'object' || value === null) {
      return { isValid: false, errorMessage: 'Please select a date range' };
    }

    // Check if value has from and to dates (not start/end)
    // The date range object uses 'from' and 'to' properties
    // Note: 0 is a valid timestamp (January 1, 1970), so we check for undefined/null only
    const hasFrom = value.from !== undefined && value.from !== null;
    const hasTo = value.to !== undefined && value.to !== null;

    if (!hasFrom || !hasTo) {
      return { isValid: false, errorMessage: 'Please select both start and end dates' };
    }

    // Validate date formats
    const startDate = new Date(value.from);
    const endDate = new Date(value.to);

    if (isNaN(startDate.getTime())) {
      return { isValid: false, errorMessage: 'Please enter a valid start date' };
    }

    if (isNaN(endDate.getTime())) {
      return { isValid: false, errorMessage: 'Please enter a valid end date' };
    }

    // Check that start is before end
    if (startDate > endDate) {
      return { isValid: false, errorMessage: 'Start date must be before end date' };
    }

    return { isValid: true };
  }
}

/**
 * Validator for DateTimeRange fields
 * Validates that start date/time is before end date/time
 */
export class DateTimeRangeValidator implements FieldValidator {
  validate(value: any, field: FormField): ValidationResult {
    // Not required and empty - valid
    if (!field.required && !value) {
      return { isValid: true };
    }

    // Required and empty - invalid
    if (field.required && !value) {
      return { isValid: false, errorMessage: 'Please select a date/time range' };
    }

    // Check if value is an object with from/to properties
    if (typeof value !== 'object' || value === null) {
      return { isValid: false, errorMessage: 'Please select a date/time range' };
    }

    // Check if value has from and to dates (not start/end)
    // The date-time range object uses 'from' and 'to' properties
    // Note: 0 is a valid timestamp (January 1, 1970), so we check for undefined/null only
    const hasFrom = value.from !== undefined && value.from !== null;
    const hasTo = value.to !== undefined && value.to !== null;

    if (!hasFrom || !hasTo) {
      return { isValid: false, errorMessage: 'Please select both start and end date/times' };
    }

    // Validate date formats
    const startDateTime = new Date(value.from);
    const endDateTime = new Date(value.to);

    if (isNaN(startDateTime.getTime())) {
      return { isValid: false, errorMessage: 'Please enter a valid start date/time' };
    }

    if (isNaN(endDateTime.getTime())) {
      return { isValid: false, errorMessage: 'Please enter a valid end date/time' };
    }

    // Check that start is before end
    if (startDateTime > endDateTime) {
      return { isValid: false, errorMessage: 'Start date/time must be before end date/time' };
    }

    return { isValid: true };
  }
}

/**
 * Validator for Rating fields
 * Validates rating value is within range
 */
export class RatingValidator implements FieldValidator {
  validate(value: any, field: FormField): ValidationResult {
    // Not required and empty - valid
    if (!field.required && (value === null || value === undefined)) {
      return { isValid: true };
    }

    // Required and empty - invalid
    if (field.required && (value === null || value === undefined)) {
      return { isValid: false, errorMessage: 'Please select a rating' };
    }

    // Validate rating is a number
    const rating = Number(value);
    if (isNaN(rating)) {
      return { isValid: false, errorMessage: 'Please select a valid rating' };
    }

    // Check min rating (default 1)
    const minRating = field.attributeValues?.['minRating'] || 1;
    if (rating < minRating) {
      return { isValid: false, errorMessage: `Rating must be at least ${minRating}` };
    }

    // Check max rating (default 5)
    const maxRating = field.attributeValues?.['maxRating'] || 5;
    if (rating > maxRating) {
      return { isValid: false, errorMessage: `Rating must be at most ${maxRating}` };
    }

    return { isValid: true };
  }
}

/**
 * Validator for File fields
 * Validates file upload and file type
 */
export class FileValidator implements FieldValidator {
  validate(value: any, field: FormField): ValidationResult {
    // Not required and empty - valid
    if (!field.required && !value) {
      return { isValid: true };
    }

    // Required and empty - invalid
    if (field.required && !value) {
      return { isValid: false, errorMessage: 'Please upload a file' };
    }

    // Validate file using original app's validation logic
    if (value instanceof File) {
      const fileTypes = field.attributeValues?.['fileTypes'] || [];
      const excludedExtensions = field.attributeValues?.['excludedFileExtensions'] || [];

      // Convert file sizes from configured units to bytes (matching original app logic)
      const fileSizeMultipliers: { [key: string]: number } = {
        'kb': 1024,
        'mb': 1024 * 1024
      };

      let minFileSize: number | undefined;
      let maxFileSize: number | undefined;

      const minFileSizeValue = field.attributeValues?.['minFileSize'];
      const minFileSizeUnit = field.attributeValues?.['minFileSizeUnit'];
      if (minFileSizeValue && !isNaN(+minFileSizeValue) && minFileSizeUnit) {
        const multiplier = fileSizeMultipliers[minFileSizeUnit.toLowerCase()];
        if (multiplier) {
          minFileSize = +minFileSizeValue * multiplier;
        }
      }

      const maxFileSizeValue = field.attributeValues?.['maxFileSize'];
      const maxFileSizeUnit = field.attributeValues?.['maxFileSizeUnit'];
      if (maxFileSizeValue && !isNaN(+maxFileSizeValue) && maxFileSizeUnit) {
        const multiplier = fileSizeMultipliers[maxFileSizeUnit.toLowerCase()];
        if (multiplier) {
          maxFileSize = +maxFileSizeValue * multiplier;
        }
      }

      const validationError = validateFile(value, fileTypes, excludedExtensions, minFileSize, maxFileSize);

      if (validationError) {
        return { isValid: false, errorMessage: validationError };
      }
    }

    return { isValid: true };
  }
}
