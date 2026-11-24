import { FormField } from '../message.model';
import { TranslateService } from '@ngx-translate/core';

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errorMessage?: string;
}

/**
 * Base interface for field validators
 * Each validator implements a specific validation rule
 */
export interface FieldValidator {
  /**
   * Validate a field value
   * @param value - The value to validate
   * @param field - The field configuration
   * @returns ValidationResult with isValid flag and optional error message
   */
  validate(value: any, field: FormField): ValidationResult;
}

/**
 * Global TranslateService instance
 * Set by the app initializer to make it available to validators
 */
let globalTranslateService: TranslateService | null = null;

/**
 * Set the global TranslateService instance
 * Called by the app initializer
 */
export function setGlobalTranslateService(service: TranslateService): void {
  globalTranslateService = service;
}

/**
 * Helper function to get translated validation messages
 * Uses TranslateService like original app uses i18next.t()
 */
function getTranslation(key: string, params?: any): string {
  if (globalTranslateService) {
    return globalTranslateService.instant(`krista.validators.${key}`, params);
  }
  // Fallback to English if TranslateService is not available
  return getFallbackMessage(key, params);
}

/**
 * Fallback messages in English (used when TranslateService is not available)
 */
function getFallbackMessage(key: string, params?: any): string {
  const fallbacks: Record<string, string> = {
    required: 'This field is required.',
    noSelection: 'No option selected.',
    noOptions: 'Options not available.',
    invalidPhoneNumber: 'Invalid phone number.',
    enterCorrectValues: 'Ensure that you enter appropriate values.',
    invalidEmail: 'Please enter a valid email address.'
  };
  return fallbacks[key] || key;
}

/**
 * Validation messages - now uses translation service
 * Matches original app's approach with i18next.t('krista.validators.*')
 */
export const VALIDATION_MESSAGES = {
  get required(): string {
    return getTranslation('required');
  },
  get noSelection(): string {
    return getTranslation('noSelection');
  },
  get noOptions(): string {
    return getTranslation('noOptions');
  },
  get invalidEmail(): string {
    return getTranslation('invalidEmail');
  },
  get invalidPhoneNumber(): string {
    return getTranslation('invalidPhoneNumber');
  },
  get enterCorrectValues(): string {
    return getTranslation('enterCorrectValues');
  },
  minLength(length: number): string {
    return getTranslation('minLength', { length });
  },
  maxLength(length: number): string {
    return getTranslation('maxLength', { length });
  },
  minValue(min: number): string {
    return getTranslation('minValue', { min });
  },
  maxValue(max: number): string {
    return getTranslation('maxValue', { max });
  },
  minSelection(count: number): string {
    return getTranslation('minSelection', { count });
  },
  maxSelection(count: number): string {
    return getTranslation('maxSelection', { count });
  },
  pattern(pattern: string): string {
    return getTranslation('pattern', { pattern });
  },
  allowedEmailDomains(domains: string): string {
    return getTranslation('allowedEmailDomains', { domains });
  }
};

