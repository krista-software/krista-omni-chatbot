import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import moment from 'moment';
import { FormField } from '../../../models/message.model';
import { FieldValidation, VALIDATION_MESSAGES } from '../../../interfaces/field-validation.interface';
import { KristaFieldService } from '../../../services/krista-field.service';
import { BasicFieldConfig } from '../../../models/field-config.model';
import { DateRangePickerComponent, DateRangePickerData, DateRangePickerResult } from '../../shared/date-range-picker/date-range-picker.component';
import { getFieldLabel } from '../shared/field-label.utils';

export interface DateRange {
  from: number | null;
  to: number | null;
}

/**
 * Self-contained date range field component.
 * This component handles date range selection, validation, min/max date constraints,
 * and duration limits internally, making it library-ready with minimal parent dependencies.
 */
@Component({
  selector: 'app-date-range-field',
  templateUrl: './date-range-field.component.html',
  styleUrls: ['./date-range-field.component.css'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DateRangeFieldComponent implements FieldValidation {
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
    private cdr: ChangeDetectorRef
  ) {}

  onStartDateChange(event: any): void {
    const startDate = event.value;
    const currentRange = this.getDateRangeValue();

    if (startDate) {
      const startTimestamp = startDate.getTime();
      const newRange: DateRange = {
        from: startTimestamp,
        to: currentRange?.to !== undefined ? currentRange.to : null  // Preserve existing "to" value, even if 0
      };

      // Only adjust "to" date if both dates exist and "to" is before "from"
      if (newRange.to !== null && newRange.from && newRange.to < newRange.from) {
        newRange.to = newRange.from;
      }

      this.valueChange.emit(this.formatDateRangeForSubmission(newRange));
    } else {
      // If start date is cleared, clear the entire range
      this.valueChange.emit(null);
    }
  }

  onEndDateChange(event: any): void {
    const endDate = event.value;
    const currentRange = this.getDateRangeValue();

    if (endDate) {
      const endTimestamp = endDate.getTime();
      const newRange: DateRange = {
        from: currentRange?.from !== undefined ? currentRange.from : null,  // Preserve existing "from" value, even if 0
        to: endTimestamp
      };

      // Only adjust "from" date if both dates exist and "from" is after "to"
      if (newRange.from !== null && newRange.to && newRange.to < newRange.from) {
        newRange.from = newRange.to;
      }

      this.valueChange.emit(this.formatDateRangeForSubmission(newRange));
    } else {
      // If end date is cleared, keep only start date (if it exists)
      if (currentRange?.from !== undefined) {
        const newRange: DateRange = {
          from: currentRange.from,
          to: null
        };
        this.valueChange.emit(this.formatDateRangeForSubmission(newRange));
      } else {
        // If no start date either, clear everything
        this.valueChange.emit(null);
      }
    }
  }

  getDateRangeValue(): DateRange | null {
    if (!this.field.value) return null;

    // Handle different possible value formats
    // Allow partial ranges (only from or only to) to support filling in one date at a time
    if (typeof this.field.value === 'object') {
      return {
        from: this.field.value.from !== undefined ? this.field.value.from : null,
        to: this.field.value.to !== undefined ? this.field.value.to : null
      };
    }

    return null;
  }

  getStartDateValue(): Date | null {
    const range = this.getDateRangeValue();
    return range?.from ? new Date(range.from) : null;
  }

  getEndDateValue(): Date | null {
    const range = this.getDateRangeValue();
    return range?.to ? new Date(range.to) : null;
  }

  getFormattedDateRangeValue(): string {
    const range = this.getDateRangeValue();
    if (!range || (range.from === undefined && range.to === undefined)) return '';

    const dateFormat = this.field.attributeValues?.['dateFormat'];

    const formatDate = (dateValue: string | number | Date) => {
      try {
        if (dateFormat) {
          return moment(dateValue).format(dateFormat);
        }
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

    const fromFormatted = (range.from !== undefined && range.from !== null) ? formatDate(range.from) : '';
    const toFormatted = (range.to !== undefined && range.to !== null) ? formatDate(range.to) : '';

    if (fromFormatted && toFormatted) {
      return `${fromFormatted} - ${toFormatted}`;
    } else if (fromFormatted) {
      return `From ${fromFormatted}`;
    } else if (toFormatted) {
      return `Until ${toFormatted}`;
    }

    return '';
  }

  /**
   * Check if date range has a value
   */
  hasDateRangeValue(): boolean {
    const range = this.getDateRangeValue();
    return !!(range && (range.from !== undefined && range.from !== null || range.to !== undefined && range.to !== null));
  }

  /**
   * Clear the selected date range
   */
  clearDateRange(event: Event): void {
    event.stopPropagation(); // Prevent opening the date range picker
    event.preventDefault();
    this.valueChange.emit(undefined);
    this.cdr.markForCheck();
  }

  private formatDateRangeForSubmission(range: DateRange): any {
    // Format to match original app's DateRange structure
    return {
      type: "com.krista.net.model.fieldschemas.DateRange",
      from: range.from,
      to: range.to
    };
  }

  getMinDate(): Date | null {
    const allowedRange = this.field.attributeValues?.['allowedRange'];
    if (allowedRange && allowedRange.from) {
      return new Date(allowedRange.from);
    }

    // Check allowPast attribute
    const allowPast = this.field.attributeValues?.['allowPast'];
    if (allowPast === false) {
      return new Date(); // Today is minimum
    }

    return null;
  }

  getMaxDate(): Date | null {
    const allowedRange = this.field.attributeValues?.['allowedRange'];
    if (allowedRange && allowedRange.to) {
      return new Date(allowedRange.to);
    }

    // Check allowFuture attribute
    const allowFuture = this.field.attributeValues?.['allowFuture'];
    if (allowFuture === false) {
      return new Date(); // Today is maximum
    }

    return null;
  }

  getMaxDurationInDays(): number | null {
    return this.field.attributeValues?.['maxDurationInDays'] || null;
  }

  isFieldRequired(): boolean {
    return this.field.required || false;
  }

  isSecured(): boolean {
    return this.field.attributeValues?.['isSecured'] === true;
  }

  isFieldReadOnly(): boolean {
    // Use parent's readOnly status (which includes message-level logic) or field-level readOnly
    return this.config?.readOnly || this.field.readOnly || false;
  }

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

  getPlaceholder(type: 'start' | 'end'): string {
    if (this.isFieldReadOnly()) {
      return '';
    }
    return type === 'start' ? 'Select start date' : 'Select end date';
  }

  getHelpText(): string {
    const maxDuration = this.getMaxDurationInDays();
    const minDate = this.getMinDate();
    const maxDate = this.getMaxDate();

    let helpText = '';

    if (maxDuration) {
      helpText += `Maximum duration: ${maxDuration} days. `;
    }

    if (minDate && maxDate) {
      helpText += `Select dates between ${minDate.toLocaleDateString()} and ${maxDate.toLocaleDateString()}.`;
    } else if (minDate) {
      helpText += `Select dates from ${minDate.toLocaleDateString()} onwards.`;
    } else if (maxDate) {
      helpText += `Select dates up to ${maxDate.toLocaleDateString()}.`;
    }

    return helpText.trim();
  }

  // FieldValidation interface implementation
  validateField(): string | null {
    const { isValid, errorMessage } = this.kristaFieldService.validateField(this.field as any, this.field?.value);
    return isValid ? null : (errorMessage || VALIDATION_MESSAGES.enterCorrectValues);
  }

  isFieldEmpty(): boolean {
    const range = this.getDateRangeValue();
    return !range || (range.from === undefined && range.to === undefined);
  }

  /**
   * Open the custom date range picker modal
   */
  openDateRangePicker(): void {
    if (this.isFieldReadOnly()) {
      return;
    }

    const currentRange = this.getDateRangeValue();
    const maxDuration = this.getMaxDurationInDays();

    const dialogData: DateRangePickerData = {
      startDate: currentRange?.from ? moment(currentRange.from) : undefined,
      endDate: currentRange?.to ? moment(currentRange.to) : undefined,
      label: this.field.displayName || this.field.name,
      minDate: this.getMinDate() ? moment(this.getMinDate()) : undefined,
      maxDate: this.getMaxDate() ? moment(this.getMaxDate()) : undefined,
      today: moment(),
      allowToday: true,
      allowTime: false,
      range: true,
      maxDaysSelection: maxDuration ?? undefined
    };

    const dialogRef = this.dialog.open(DateRangePickerComponent, {
      width: '360px',
      maxHeight: '90vh',
      panelClass: 'date-picker-dialog',
      data: dialogData
    });

    dialogRef.afterClosed().subscribe((result: DateRangePickerResult) => {
      if (result && result.action === 'save') {
        if (result.startDate || result.endDate) {
          const newRange: DateRange = {
            from: result.startDate ? result.startDate.valueOf() : null,
            to: result.endDate ? result.endDate.valueOf() : null
          };
          this.valueChange.emit(this.formatDateRangeForSubmission(newRange));
        } else {
          this.valueChange.emit(null);
        }
        this.cdr.markForCheck();
      }
    });
  }
}
