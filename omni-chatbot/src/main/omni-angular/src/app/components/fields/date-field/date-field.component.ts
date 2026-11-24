import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import moment from 'moment';
import { TranslateService } from '@ngx-translate/core';
import { FormField } from '../../../models/message.model';
import { FieldValidation, VALIDATION_MESSAGES, ValidationUtils } from '../../../interfaces/field-validation.interface';
import { KristaFieldService } from '../../../services/krista-field.service';
import { BasicFieldConfig } from '../../../models/field-config.model';
import { DateRangePickerComponent, DateRangePickerData, DateRangePickerResult } from '../../shared/date-range-picker/date-range-picker.component';
import { getFieldLabel } from '../shared/field-label.utils';

/**
 * Self-contained date field component.
 * This component handles date selection, validation, and min/max date constraints internally,
 * making it library-ready with minimal parent dependencies.
 * Emits timestamp values (milliseconds) to match original app behavior.
 */
@Component({
  selector: 'app-date-field',
  templateUrl: './date-field.component.html',
  styleUrls: ['./date-field.component.css'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DateFieldComponent implements FieldValidation, OnInit {
  @Input() field!: FormField;
  @Input() config: BasicFieldConfig = {
    hasError: false,
    errorMessage: '',
    readOnly: false
  };
  @Output() valueChange = new EventEmitter<any>();

  constructor(
    private kristaFieldService: KristaFieldService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    private translate: TranslateService
  ) {}

  /**
   * Normalize field value on initialization
   * Convert string dates (e.g., "2025-11-18") to timestamps to match original app behavior
   */
  ngOnInit(): void {
    if (this.field.value && typeof this.field.value === 'string') {
      // Convert string date to timestamp
      const date = new Date(this.field.value);
      if (!isNaN(date.getTime())) {
        const allowTime = this.field.attributeValues?.['includeTimeOfDay'] || false;
        // Strip time component (set to midnight) only if time is not included
        if (!allowTime) {
          date.setHours(0, 0, 0, 0);
        }
        // Update field value to timestamp
        this.field.value = date.getTime();
      }
    }
  }

  /**
   * Handle date change from datepicker
   * Converts Date to timestamp (milliseconds) to match original app behavior
   * original app uses dayjs.valueOf() which returns timestamp with time stripped to midnight
   */
  onDateChange(event: any): void {
    const date = event.value;
    if (date) {
      // Strip time component (set to midnight) to match original app's datePlus.stripTime
      const strippedDate = new Date(date);
      strippedDate.setHours(0, 0, 0, 0);

      // Emit timestamp in milliseconds
      this.valueChange.emit(strippedDate.getTime());
    } else {
      this.valueChange.emit(undefined);
    }
  }

  /**
   * Open the custom date picker modal
   */
  openDatePicker(): void {
    if (this.isFieldReadOnly()) {
      return;
    }

    const allowTime = this.field.attributeValues?.['includeTimeOfDay'] || false;
    const allowToday = this.field.attributeValues?.['allowToday'] !== false;

    const dialogData: DateRangePickerData = {
      date: this.field.value ? moment(this.field.value) : undefined,
      label: this.field.displayName || this.field.name,
      minDate: this.getMinDate() ? moment(this.getMinDate()) : undefined,
      maxDate: this.getMaxDate() ? moment(this.getMaxDate()) : undefined,
      today: moment(),
      allowToday: allowToday,
      allowTime: allowTime,
      range: false
    };

    const dialogRef = this.dialog.open(DateRangePickerComponent, {
      width: '360px',
      maxHeight: '90vh',
      panelClass: 'date-picker-dialog',
      data: dialogData
    });

    dialogRef.afterClosed().subscribe((result: DateRangePickerResult) => {
      if (result && result.action === 'save') {
        if (result.date) {
          // Strip time component if not using time
          if (!allowTime) {
            result.date.set('hour', 0).set('minute', 0).set('second', 0);
          }
          this.valueChange.emit(result.date.valueOf());
        } else {
          this.valueChange.emit(undefined);
        }
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * Clear the selected date
   */
  clearDate(event: Event): void {
    event.stopPropagation(); // Prevent opening the date picker
    event.preventDefault();
    this.valueChange.emit(undefined);
    this.cdr.markForCheck();
  }

  getDateValue(): Date | null {
    if (!this.field.value) return null;
    const date = new Date(this.field.value);
    return isNaN(date.getTime()) ? null : date;
  }

  getFormattedDateValue(): string {
    if (!this.field.value) return '';

    const date = new Date(this.field.value);
    if (isNaN(date.getTime())) return this.field.value.toString();

    const allowTime = this.field.attributeValues?.['includeTimeOfDay'] || false;
    const dateFormat = this.field.attributeValues?.['dateFormat'];

    // Use custom dateFormat if provided (moment.js format tokens)
    if (dateFormat) {
      const m = moment(this.field.value);
      if (allowTime) {
        return m.format(`${dateFormat}, hh:mm A`);
      }
      return m.format(dateFormat);
    }

    // Default format (e.g., "December 25, 2023")
    const datePart = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    if (allowTime) {
      const timePart = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      return `${datePart}, ${timePart}`;
    }

    return datePart;
  }

  isFieldRequired(): boolean {
    return this.field.required || false;
  }

  isSecured(): boolean {
    return this.field.attributeValues?.['isSecured'] === true;
  }

  isFieldReadOnly(): boolean {
    // Use parent's readOnly status (which includes message-level logic) or field-level readOnly
    return this.config.readOnly || this.field.readOnly || false;
  }

  getPlaceholder(): string {
    if (this.isFieldReadOnly()) {
      return '';
    }
    // Use displayName if available (for sub-fields), otherwise use name
    const fieldName = this.field.displayName || this.field.name;
    // Use translation service like: t("placeholder.select", { fieldName })
    return this.translate.instant('placeholder.select', { fieldName });
  }

  // FieldValidation interface implementation
  validateField(): string | null {
    const { isValid, errorMessage } = this.kristaFieldService.validateField(this.field as any, this.field?.value);
    return isValid ? null : (errorMessage || VALIDATION_MESSAGES.enterCorrectValues);
  }

  isFieldEmpty(): boolean {
    return !this.field.value || this.field.value.toString().trim() === '';
  }

  /**
   * Get minimum allowed date based on field attributes
   */
  getMinDate(): Date | null {
    const allowPast = this.field.attributeValues?.['allowPast'];
    const allowToday = this.field.attributeValues?.['allowToday'];
    const minDate = this.field.attributeValues?.['minDate'];

    // If explicit minDate is set, use it
    if (minDate) {
      return new Date(minDate);
    }

    // Otherwise, calculate based on allowPast and allowToday
    if (allowPast === false) {
      if (allowToday === false) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return tomorrow;
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today;
      }
    }

    return null;
  }

  /**
   * Get maximum allowed date based on field attributes
   */
  getMaxDate(): Date | null {
    const allowFuture = this.field.attributeValues?.['allowFuture'];
    const allowToday = this.field.attributeValues?.['allowToday'];
    const maxDate = this.field.attributeValues?.['maxDate'];

    // If explicit maxDate is set, use it
    if (maxDate) {
      return new Date(maxDate);
    }

    // Otherwise, calculate based on allowFuture and allowToday
    if (allowFuture === false) {
      if (allowToday === false) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(23, 59, 59, 999);
        return yesterday;
      } else {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        return today;
      }
    }

    return null;
  }

  /**
   * Date filter function for mat-datepicker
   * Returns true if date is allowed, false otherwise
   */
  dateFilter = (date: Date | null): boolean => {
    if (!date) return true;

    const minDate = this.getMinDate();
    const maxDate = this.getMaxDate();

    // Normalize dates to midnight for comparison
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    if (minDate) {
      const normalizedMin = new Date(minDate);
      normalizedMin.setHours(0, 0, 0, 0);
      if (normalizedDate < normalizedMin) {
        return false;
      }
    }

    if (maxDate) {
      const normalizedMax = new Date(maxDate);
      normalizedMax.setHours(0, 0, 0, 0);
      if (normalizedDate > normalizedMax) {
        return false;
      }
    }

    return true;
  };

  /**
   * Get timezone from field attributes (if configured)
   */
  getTimezone(): string | null {
    return this.field.attributeValues?.['timezone'] || null;
  }

  /**
   * Check if label should be shown
   * Defaults to true if not specified in config
   */
  shouldShowLabel(): boolean {
    return this.config?.showLabel !== false; // Show by default unless explicitly set to false
  }

  /**
   * Get field label with i18n support
   * Uses shared utility function for consistency across all field types
   */
  getFieldLabel(): string {
    return getFieldLabel(this.field);
  }
}
