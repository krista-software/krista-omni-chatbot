import { FieldFormatter } from './field-formatter.interface';
import { FormField } from '../message.model';
import { parsePhoneNumber, AsYouType } from 'libphonenumber-js';

/**
 * Text formatter
 * Basic text formatting (trim, capitalize)
 */
export class TextFormatter implements FieldFormatter {
  format(value: any, field: FormField): string {
    if (value === undefined || value === null) {
      return '';
    }
    return value.toString();
  }

  formatOnBlur(value: any, field: FormField): any {
    if (!value) {
      return value;
    }
    // Trim whitespace
    return value.toString().trim();
  }
}

/**
 * Email formatter
 * Formats email addresses (trim, lowercase)
 */
export class EmailFormatter implements FieldFormatter {
  format(value: any, field: FormField): string {
    if (value === undefined || value === null) {
      return '';
    }
    return value.toString();
  }

  formatOnBlur(value: any, field: FormField): any {
    if (!value) {
      return value;
    }
    // Trim and convert to lowercase
    return value.toString().trim().toLowerCase();
  }
}

/**
 * Phone formatter
 * Formats phone numbers using libphonenumber-js
 */
export class PhoneFormatter implements FieldFormatter {
  /**
   * Convert phone value to string format for parsing
   * Handles both phone objects {countryCode, nationalNumber} and string values
   */
  private phoneValueToString(value: any): string {
    if (typeof value === 'object' && value !== null) {
      // Handle phone object from backend: {countryCode: 91, nationalNumber: 8989942017}
      if ('countryCode' in value && 'nationalNumber' in value) {
        const countryCode = value.countryCode;
        const nationalNumber = value.nationalNumber;

        // If countryCode is 0 or not set, return just the national number
        if (!countryCode || countryCode === 0) {
          return nationalNumber.toString();
        }

        // Format as international: +918989942017
        return `+${countryCode}${nationalNumber}`;
      }
    }

    // For string values, return as-is
    return value.toString();
  }

  format(value: any, field: FormField): string {
    if (value === undefined || value === null) {
      return '';
    }

    const stringValue = this.phoneValueToString(value);

    try {
      // Try to parse and format the phone number
      const phoneNumber = parsePhoneNumber(stringValue);
      if (phoneNumber && phoneNumber.isValid()) {
        // Format as international format for display
        return phoneNumber.formatInternational();
      }
    } catch (error) {
      // If parsing fails, return as-is
    }

    return stringValue;
  }

  formatOnBlur(value: any, field: FormField): any {
    if (!value) {
      return value;
    }

    // If already a phone object, return as-is
    if (typeof value === 'object' && 'countryCode' in value && 'nationalNumber' in value) {
      return value;
    }

    const stringValue = this.phoneValueToString(value).trim();

    try {
      // Try to parse the phone number
      const phoneNumber = parsePhoneNumber(stringValue);
      if (phoneNumber && phoneNumber.isValid()) {
        // Return phone object (matches original app behavior)
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

/**
 * Number formatter
 * Formats numeric values
 */
export class NumberFormatter implements FieldFormatter {
  format(value: any, field: FormField): string {
    if (value === undefined || value === null || value === '') {
      return '';
    }
    return value.toString();
  }

  formatOnBlur(value: any, field: FormField): any {
    if (!value) {
      return value;
    }

    const stringValue = value.toString().trim();
    const numericValue = parseFloat(stringValue);

    if (isNaN(numericValue)) {
      return stringValue;
    }

    // Return the numeric value as string
    return numericValue.toString();
  }
}

/**
 * Currency formatter
 * Formats currency values (removes $ symbol for input)
 */
export class CurrencyFormatter implements FieldFormatter {
  format(value: any, field: FormField): string {
    if (value === undefined || value === null || value === '') {
      return '';
    }
    
    // Remove $ symbol for display in input
    return value.toString().replace('$', '');
  }

  formatOnBlur(value: any, field: FormField): any {
    if (!value) {
      return value;
    }

    const stringValue = value.toString().trim().replace('$', '');
    const numericValue = parseFloat(stringValue);

    if (isNaN(numericValue)) {
      return stringValue;
    }

    // Return the numeric value as string (without $ symbol)
    return numericValue.toString();
  }
}

/**
 * Percentage formatter
 * Formats percentage values (filters input, stores as numeric value without %)
 * Matches original app behavior: user enters "20", we store 20 (not "20%")
 */
export class PercentageFormatter implements FieldFormatter {
  format(value: any, field: FormField): string {
    if (value === undefined || value === null || value === '') {
      return '';
    }

    const stringValue = value.toString();

    // Remove ALL % signs first (using global replace)
    // This handles cases like "1%0" -> "10" or "10%%" -> "10"
    let filtered = stringValue.replace(/%/g, '');

    // Filter to only allow numbers and decimal point
    filtered = filtered.replace(/[^0-9.]/g, '');

    // Ensure only one decimal point
    const decimalParts = filtered.split('.');
    if (decimalParts.length > 2) {
      filtered = decimalParts[0] + '.' + decimalParts.slice(1).join('');
    }

    return filtered;
  }

  formatOnBlur(value: any, field: FormField): any {
    if (!value) {
      return value;
    }

    const stringValue = value.toString().trim();

    // Remove all % signs (using global replace)
    const numericValue = stringValue.replace(/%/g, '');

    if (numericValue && !isNaN(Number(numericValue))) {
      // Return numeric value WITHOUT % symbol
      // The % will be added only for display in the UI
      return Number(numericValue);
    }

    return value;
  }
}

/**
 * Proper noun formatter
 * Capitalizes first letter of each word
 */
export class ProperNounFormatter implements FieldFormatter {
  format(value: any, field: FormField): string {
    if (value === undefined || value === null) {
      return '';
    }
    return value.toString();
  }

  formatOnBlur(value: any, field: FormField): any {
    if (!value) {
      return value;
    }

    const stringValue = value.toString().trim();

    // Capitalize first letter of each word
    return stringValue.replace(/\b\w+/g, (word: string) => {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
  }
}

/**
 * Identifier formatter
 * Removes special characters and converts to uppercase
 */
export class IdentifierFormatter implements FieldFormatter {
  format(value: any, field: FormField): string {
    if (value === undefined || value === null) {
      return '';
    }
    return value.toString();
  }

  formatOnBlur(value: any, field: FormField): any {
    if (!value) {
      return value;
    }

    // Remove special characters and convert to uppercase
    return value.toString().replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
  }
}

/**
 * Address formatter
 * Capitalizes address components with special handling for abbreviations
 */
export class AddressFormatter implements FieldFormatter {
  private readonly upperCaseWords = ['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW', 'ST', 'AVE', 'BLVD', 'RD', 'DR', 'LN', 'CT', 'PL'];

  format(value: any, field: FormField): string {
    if (value === undefined || value === null) {
      return '';
    }
    return value.toString();
  }

  formatOnBlur(value: any, field: FormField): any {
    if (!value || !value.trim()) {
      return value;
    }

    return value.toString().replace(/\b\w+/g, (word: string) => {
      if (this.upperCaseWords.includes(word.toUpperCase())) {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
  }
}

/**
 * Postal code formatter
 * Converts to uppercase and trims
 */
export class PostalCodeFormatter implements FieldFormatter {
  format(value: any, field: FormField): string {
    if (value === undefined || value === null) {
      return '';
    }
    return value.toString();
  }

  formatOnBlur(value: any, field: FormField): any {
    if (!value) {
      return value;
    }

    return value.toString().trim().toUpperCase();
  }
}

/**
 * Date Range formatter
 * Formats date range objects to readable strings
 */
export class DateRangeFormatter implements FieldFormatter {
  format(value: any, field: FormField): string {
    if (value === undefined || value === null) {
      return '';
    }

    // Handle date range object
    if (typeof value === 'object' && value !== null) {
      const from = value.from;
      const to = value.to;

      if (from === undefined && to === undefined) {
        return '';
      }

      const formatDate = (dateValue: string | number | Date) => {
        try {
          const date = new Date(dateValue);
          if (isNaN(date.getTime())) return dateValue.toString();
          return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          });
        } catch (e) {
          return dateValue.toString();
        }
      };

      const fromFormatted = (from !== undefined && from !== null) ? formatDate(from) : '';
      const toFormatted = (to !== undefined && to !== null) ? formatDate(to) : '';

      if (fromFormatted && toFormatted) {
        return `${fromFormatted} - ${toFormatted}`;
      } else if (fromFormatted) {
        return `From ${fromFormatted}`;
      } else if (toFormatted) {
        return `Until ${toFormatted}`;
      }

      return '';
    }

    return value.toString();
  }

  formatOnBlur(value: any, field: FormField): any {
    // Date range values are already formatted by the component
    return value;
  }
}

/**
 * Date Time Range formatter
 * Formats date-time range objects to readable strings
 */
export class DateTimeRangeFormatter implements FieldFormatter {
  format(value: any, field: FormField): string {
    if (value === undefined || value === null) {
      return '';
    }

    // Handle date-time range object
    if (typeof value === 'object' && value !== null) {
      const from = value.from;
      const to = value.to;

      if (from === undefined && to === undefined) {
        return '';
      }

      const formatDateTime = (dateTimeValue: string | number | Date) => {
        try {
          const date = new Date(dateTimeValue);
          if (isNaN(date.getTime())) return dateTimeValue.toString();

          const dateFormatted = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          });

          const timeFormatted = date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });

          return `${dateFormatted} at ${timeFormatted}`;
        } catch (e) {
          return dateTimeValue.toString();
        }
      };

      const fromFormatted = (from !== undefined && from !== null) ? formatDateTime(from) : '';
      const toFormatted = (to !== undefined && to !== null) ? formatDateTime(to) : '';

      if (fromFormatted && toFormatted) {
        return `${fromFormatted} - ${toFormatted}`;
      } else if (fromFormatted) {
        return `From ${fromFormatted}`;
      } else if (toFormatted) {
        return `Until ${toFormatted}`;
      }

      return '';
    }

    return value.toString();
  }

  formatOnBlur(value: any, field: FormField): any {
    // Date-time range values are already formatted by the component
    return value;
  }
}

/**
 * Location formatter
 * Formats location objects to readable strings
 * Matches original app's Location.toString() logic
 */
export class LocationFormatter implements FieldFormatter {
  format(value: any, field: FormField): string {
    if (value === undefined || value === null) {
      return '';
    }

    // If value is a Location object
    if (typeof value === 'object' && value.latitude !== undefined) {
      const loc = value;

      // If address is available, use it
      if (loc.address) {
        return loc.address;
      }

      // Otherwise, build from components
      if (loc.city || loc.country) {
        const parts = [loc.area, loc.city, loc.state, loc.zip, loc.country].filter((p: any) => p);
        return parts.join(', ');
      }

      // Fallback to coordinates
      return `${loc.latitude}, ${loc.longitude}`;
    }

    // If value is a string, return as-is
    return String(value);
  }

  formatOnBlur(value: any, field: FormField): any {
    // Location values are already formatted by the component
    return value;
  }
}

/**
 * EntitySelectionFormatter - Formats entity selection values
 * Displays the textSummary of selected entity/entities
 */
export class EntitySelectionFormatter implements FieldFormatter {
  format(value: any, field: FormField): string {
    if (!value) {
      return '';
    }

    // Handle array of entities (multi-select)
    if (Array.isArray(value)) {
      return value
        .map(entity => entity.textSummary || '')
        .filter(summary => summary.length > 0)
        .join(', ');
    }

    // Handle single entity
    if (typeof value === 'object' && value.textSummary) {
      return value.textSummary;
    }

    return '';
  }

  formatOnBlur(value: any, field: FormField): any {
    // Entity values are already formatted by the component
    return value;
  }
}
