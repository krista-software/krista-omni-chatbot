import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/**
 * Service for getting translated validation messages
 * Matches original app's i18next.t() approach for validator error messages
 */
@Injectable({
  providedIn: 'root'
})
export class ValidationMessagesService {
  constructor(private translate: TranslateService) {}

  /**
   * Get translated validation message
   * Uses the same translation keys as original app (krista.validators.*)
   */
  get(key: string, params?: any): string {
    return this.translate.instant(`krista.validators.${key}`, params);
  }

  // Convenience methods for common validation messages
  required(): string {
    return this.get('required');
  }

  invalidPhoneNumber(): string {
    return this.get('invalidPhoneNumber');
  }

  minLength(length: number): string {
    return this.get('minLength', { length });
  }

  maxLength(length: number): string {
    return this.get('maxLength', { length });
  }

  minValue(min: number): string {
    return this.get('minValue', { min });
  }

  maxValue(max: number): string {
    return this.get('maxValue', { max });
  }

  minSelection(count: number): string {
    return this.get('minSelection', { count });
  }

  maxSelection(count: number): string {
    return this.get('maxSelection', { count });
  }

  pattern(pattern: string): string {
    return this.get('pattern', { pattern });
  }

  allowedEmailDomains(domains: string): string {
    return this.get('allowedEmailDomains', { domains });
  }

  maxDateRangeInDays(days: number): string {
    return this.get('maxDateRangeInDays', { days });
  }

  maxDateRangeInHours(hours: number): string {
    return this.get('maxDateRangeInHours', { hours });
  }

  startDateLessThanEndDate(): string {
    return this.get('startDateLessThanEndDate');
  }
}

