import { FormField } from '../models/message.model';

/**
 * Interface for field validation
 * Each field component should implement this interface to handle its own validation
 */
export interface FieldValidation {
  /**
   * Validate the field and return error message if invalid, null if valid
   */
  validateField(): string | null;
  
  /**
   * Check if the field is empty
   */
  isFieldEmpty(): boolean;
  
  /**
   * Check if the field is required
   */
  isFieldRequired(): boolean;
}

/**
 * Validation messages that can be used across all field components
 */
export const VALIDATION_MESSAGES = {
  required: 'This field is required.',
  invalidEmail: 'Please enter a valid email address.',
  invalidPhoneNumber: 'Please enter a valid phone number.',
  invalidUrl: 'Please enter a valid URL.',
  invalidDate: 'Please enter a valid date.',
  invalidTime: 'Please enter a valid time.',
  invalidNumber: 'Please enter a valid number.',
  invalidPercentage: 'Please enter a valid percentage.',
  minLength: 'Minimum length is {length} characters.',
  maxLength: 'Maximum length is {length} characters.',
  minValue: 'Value should be greater than or equal to {min}.',
  maxValue: 'Value should be less than or equal to {max}.',
  enterCorrectValues: 'Ensure that you enter appropriate values.',
  selectAtLeastOne: 'Please select at least one option.',
  fileRequired: 'Please select a file.',
  invalidFileType: 'Invalid file type.',
  fileSizeExceeded: 'File size exceeds the maximum allowed size.',
  domainNotAllowed: 'Email domain is not allowed. Allowed domains: {domains}.'
};

/**
 * Base validation utility functions
 */
export class ValidationUtils {
  /**
   * Validate email format
   */
  static validateEmail(value: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }

  /**
   * Validate URL format
   */
  static validateUrl(value: string): boolean {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate number format
   */
  static validateNumber(value: string): boolean {
    return !isNaN(Number(value)) && isFinite(Number(value));
  }

  /**
   * Validate percentage format
   */
  static validatePercentage(value: string): boolean {
    const cleanValue = value.replace('%', '').trim();
    const numValue = Number(cleanValue);
    return !isNaN(numValue) && isFinite(numValue) && numValue >= 0 && numValue <= 100;
  }

  /**
   * Check if value is within min/max range
   */
  static validateRange(value: number, min?: number, max?: number): { valid: boolean; error?: string } {
    if (min !== undefined && value < min) {
      return { valid: false, error: VALIDATION_MESSAGES.minValue.replace('{min}', min.toString()) };
    }
    if (max !== undefined && value > max) {
      return { valid: false, error: VALIDATION_MESSAGES.maxValue.replace('{max}', max.toString()) };
    }
    return { valid: true };
  }

  /**
   * Check if text length is within min/max range
   */
  static validateTextLength(value: string, min?: number, max?: number): { valid: boolean; error?: string } {
    if (min !== undefined && value.length < min) {
      return { valid: false, error: VALIDATION_MESSAGES.minLength.replace('{length}', min.toString()) };
    }
    if (max !== undefined && value.length > max) {
      return { valid: false, error: VALIDATION_MESSAGES.maxLength.replace('{length}', max.toString()) };
    }
    return { valid: true };
  }
}
