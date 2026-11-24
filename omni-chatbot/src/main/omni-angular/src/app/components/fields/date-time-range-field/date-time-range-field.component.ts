import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import moment from 'moment';
import { FormField } from '../../../models/message.model';
import { FieldValidation, VALIDATION_MESSAGES } from '../../../interfaces/field-validation.interface';
import { KristaFieldService } from '../../../services/krista-field.service';
import { BasicFieldConfig } from '../../../models/field-config.model';
import { DateRangePickerComponent, DateRangePickerData, DateRangePickerResult } from '../../shared/date-range-picker/date-range-picker.component';
import { getFieldLabel } from '../shared/field-label.utils';

export interface DateTimeRange {
  from: number | null;
  to: number | null;
}

/**
 * Self-contained date-time range field component.
 * This component handles date-time range selection, validation, min/max date constraints,
 * and time picker interactions internally, making it library-ready with minimal parent dependencies.
 */
@Component({
  selector: 'app-date-time-range-field',
  templateUrl: './date-time-range-field.component.html',
  styleUrls: ['./date-time-range-field.component.css'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DateTimeRangeFieldComponent implements FieldValidation {
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

  onStartDateTimeChange(dateValue: any, timeValue?: string): void {
    const currentRange = this.getDateTimeRangeValue();

    if (dateValue) {
      const date = new Date(dateValue);
      const time = timeValue || this.getStartTimeValue() || '00:00';
      const [hours, minutes] = time.split(':').map(Number);

      date.setHours(hours, minutes, 0, 0);
      const startTimestamp = date.getTime();

      const newRange: DateTimeRange = {
        from: startTimestamp,
        to: currentRange?.to !== undefined ? currentRange.to : null  // Preserve existing "to" value, even if 0
      };

      // Only adjust "to" date if both dates exist and "to" is before "from"
      if (newRange.to !== null && newRange.from && newRange.to < newRange.from) {
        newRange.to = newRange.from;
      }

      this.valueChange.emit(this.formatDateTimeRangeForSubmission(newRange));
    } else {
      // If start date is cleared, clear the entire range
      this.valueChange.emit(null);
    }
  }

  onEndDateTimeChange(dateValue: any, timeValue?: string): void {
    const currentRange = this.getDateTimeRangeValue();

    if (dateValue && currentRange?.from !== undefined) {
      const date = new Date(dateValue);
      const time = timeValue || this.getEndTimeValue() || '23:59';
      const [hours, minutes] = time.split(':').map(Number);

      date.setHours(hours, minutes, 0, 0);
      const endTimestamp = date.getTime();

      const newRange: DateTimeRange = {
        from: currentRange.from,
        to: endTimestamp
      };

      // Only adjust "from" date if both dates exist and "from" is after "to"
      if (newRange.from !== null && newRange.to && newRange.to < newRange.from) {
        newRange.from = newRange.to;
      }

      this.valueChange.emit(this.formatDateTimeRangeForSubmission(newRange));
    } else if (dateValue) {
      // If only end date is set, don't auto-fill start date
      const date = new Date(dateValue);
      const time = timeValue || this.getEndTimeValue() || '23:59';
      const [hours, minutes] = time.split(':').map(Number);

      date.setHours(hours, minutes, 0, 0);
      const endTimestamp = date.getTime();

      const newRange: DateTimeRange = {
        from: currentRange?.from !== undefined ? currentRange.from : null,  // Preserve existing "from" value, even if 0
        to: endTimestamp
      };
      this.valueChange.emit(this.formatDateTimeRangeForSubmission(newRange));
    } else {
      // If end date is cleared, keep only start date (if it exists)
      if (currentRange?.from !== undefined) {
        const newRange: DateTimeRange = {
          from: currentRange.from,
          to: null
        };
        this.valueChange.emit(this.formatDateTimeRangeForSubmission(newRange));
      } else {
        // If no start date either, clear everything
        this.valueChange.emit(null);
      }
    }
  }

  onStartTimeChange(timeValue: string): void {
    const startDate = this.getStartDateValue();
    if (startDate) {
      this.onStartDateTimeChange(startDate, timeValue);
    }
  }

  onEndTimeChange(timeValue: string): void {
    const endDate = this.getEndDateValue();
    if (endDate) {
      this.onEndDateTimeChange(endDate, timeValue);
    }
  }

  /**
   * Handle time input click
   */
  onTimeInputClick(timeInput: HTMLInputElement): void {
    if (!this.isFieldReadOnly()) {
      // Try to open the time picker
      setTimeout(() => {
        if (timeInput.showPicker) {
          timeInput.showPicker();
        }
      }, 10);
    }
  }

  /**
   * Focus time input when clock icon is clicked
   */
  focusTimeInput(timeInput: HTMLInputElement): void {
    if (!this.isFieldReadOnly()) {
      timeInput.focus();

      // Try multiple approaches to open the time picker
      setTimeout(() => {
        timeInput.click();
        if (timeInput.showPicker) {
          timeInput.showPicker();
        }
      }, 10);
    }
  }

  getDateTimeRangeValue(): DateTimeRange | null {
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
    const range = this.getDateTimeRangeValue();
    return range?.from ? new Date(range.from) : null;
  }

  getEndDateValue(): Date | null {
    const range = this.getDateTimeRangeValue();
    return range?.to ? new Date(range.to) : null;
  }

  getStartTimeValue(): string {
    const range = this.getDateTimeRangeValue();
    if (range?.from) {
      const date = new Date(range.from);
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
    return '';
  }

  getEndTimeValue(): string {
    const range = this.getDateTimeRangeValue();
    if (range?.to) {
      const date = new Date(range.to);
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
    return '';
  }

  getFormattedDateTimeRangeValue(): string {
    const range = this.getDateTimeRangeValue();
    if (!range || (range.from === undefined && range.to === undefined)) return '';

    const dateFormat = this.field.attributeValues?.['dateFormat'];

    const formatDateTime = (dateTimeValue: string | number | Date) => {
      try {
        if (dateFormat) {
          return moment(dateTimeValue).format(`${dateFormat}, hh:mm A`);
        }
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

    const fromFormatted = (range.from !== undefined && range.from !== null) ? formatDateTime(range.from) : '';
    const toFormatted = (range.to !== undefined && range.to !== null) ? formatDateTime(range.to) : '';

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
   * Check if date-time range has a value
   */
  hasDateTimeRangeValue(): boolean {
    const range = this.getDateTimeRangeValue();
    return !!(range && (range.from !== undefined && range.from !== null || range.to !== undefined && range.to !== null));
  }

  /**
   * Clear the selected date-time range
   */
  clearDateTimeRange(event: Event): void {
    event.stopPropagation(); // Prevent opening the date-time range picker
    event.preventDefault();
    this.valueChange.emit(undefined);
    this.cdr.markForCheck();
  }

  private formatDateTimeRangeForSubmission(range: DateTimeRange): any {
    // Format to match original app's DateTimeRange structure
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

  getPlaceholder(type: 'start' | 'end', field: 'date' | 'time'): string {
    if (this.isFieldReadOnly()) {
      return '';
    }

    if (field === 'date') {
      return type === 'start' ? 'Select start date' : 'Select end date';
    } else {
      return type === 'start' ? 'Start time' : 'End time';
    }
  }

  getHelpText(): string {
    const maxDuration = this.field.attributeValues?.['maxDurationInDays'];
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
    const range = this.getDateTimeRangeValue();
    return !range || (range.from === undefined && range.to === undefined);
  }

  /**
   * Open the custom date-time range picker modal
   */
  openDateTimeRangePicker(): void {
    if (this.isFieldReadOnly()) {
      return;
    }

    const currentRange = this.getDateTimeRangeValue();
    const maxDuration = this.field.attributeValues?.['maxDurationInDays'];
    const maxHourSelection = this.field.attributeValues?.['maxHourSelection'];

    const dialogData: DateRangePickerData = {
      startDate: currentRange?.from ? moment(currentRange.from) : undefined,
      endDate: currentRange?.to ? moment(currentRange.to) : undefined,
      label: this.field.displayName || this.field.name,
      minDate: this.getMinDate() ? moment(this.getMinDate()) : undefined,
      maxDate: this.getMaxDate() ? moment(this.getMaxDate()) : undefined,
      today: moment(),
      allowToday: true,
      allowTime: true,  // Enable time selection
      range: true,
      maxDaysSelection: maxDuration,
      maxHourSelection: maxHourSelection
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
          const newRange: DateTimeRange = {
            from: result.startDate ? result.startDate.valueOf() : null,
            to: result.endDate ? result.endDate.valueOf() : null
          };
          this.valueChange.emit(this.formatDateTimeRangeForSubmission(newRange));
        } else {
          this.valueChange.emit(null);
        }
        this.cdr.markForCheck();
      }
    });
  }
}
