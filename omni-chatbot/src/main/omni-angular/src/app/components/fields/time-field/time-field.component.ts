import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormField } from '../../../models/message.model';
import { FieldValidation, VALIDATION_MESSAGES } from '../../../interfaces/field-validation.interface';
import { KristaFieldService } from '../../../services/krista-field.service';
import { BasicFieldConfig } from '../../../models/field-config.model';
import { getFieldLabel } from '../shared/field-label.utils';

/**
 * Self-contained time field component.
 * This component handles time selection, validation, and converts time values to timestamps,
 * making it library-ready with minimal parent dependencies.
 * Emits timestamp values (milliseconds) to match original app behavior.
 */
@Component({
  selector: 'app-time-field',
  templateUrl: './time-field.component.html',
  styleUrls: ['./time-field.component.css'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimeFieldComponent implements FieldValidation, OnInit {
  // Data inputs
  @Input() field!: FormField;
  @Input() config: BasicFieldConfig = {
    hasError: false,
    errorMessage: '',
    readOnly: false
  };

  // Event outputs (emit timestamp values, parent handles business logic)
  @Output() valueChange = new EventEmitter<any>();

  constructor(private kristaFieldService: KristaFieldService) {}

  /**
   * Normalize field value on initialization
   * Convert string times (e.g., "13:11") to timestamps to match original app behavior
   */
  ngOnInit(): void {
    if (this.field.value) {
      const timeValue = this.field.value.toString().trim();

      // If it's a string in HH:MM format, convert to timestamp
      if (typeof this.field.value === 'string' && /^\d{1,2}:\d{2}$/.test(timeValue)) {
        const timestamp = this.convertTimeToTimestamp(timeValue);
        this.field.value = timestamp;
      }
      // If it's a string in HH:MM:SS format, convert to timestamp
      else if (typeof this.field.value === 'string' && /^\d{1,2}:\d{2}:\d{2}$/.test(timeValue)) {
        const timeOnly = timeValue.substring(0, 5); // Take only HH:MM part
        const timestamp = this.convertTimeToTimestamp(timeOnly);
        this.field.value = timestamp;
      }
      // If it's already a number (timestamp), keep it as is
      else if (typeof this.field.value === 'number') {
        // Already a timestamp, no conversion needed
      }
    }
  }

  /**
   * Handle time change from input
   * Converts HH:MM string to timestamp (milliseconds) to match original app behavior
   */
  onTimeChange(value: string): void {
    if (!value) {
      this.valueChange.emit(undefined);
      return;
    }

    // Convert HH:MM to timestamp
    // original app uses dayjs.valueOf() which returns timestamp in milliseconds
    const timestamp = this.convertTimeToTimestamp(value);
    this.valueChange.emit(timestamp);
  }

  /**
   * Handle time set from ngx-material-timepicker
   * Converts 12-hour format (e.g., "12:30 PM") to timestamp
   */
  onTimeSet(time: string): void {
    if (!time) {
      this.valueChange.emit(undefined);
      return;
    }

    // Parse 12-hour format (e.g., "12:30 PM")
    const timestamp = this.convert12HourToTimestamp(time);
    this.field.value = timestamp;
    this.valueChange.emit(timestamp);
  }

  /**
   * Clear the selected time
   */
  clearTime(event: Event): void {
    event.stopPropagation(); // Prevent opening the time picker
    event.preventDefault();
    this.field.value = undefined;
    this.valueChange.emit(undefined);
  }

  /**
   * Convert 12-hour time string (e.g., "12:30 PM") to timestamp
   */
  private convert12HourToTimestamp(timeString: string): number {
    const parts = timeString.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!parts) {
      return this.convertTimeToTimestamp(timeString);
    }

    let hours = parseInt(parts[1], 10);
    const minutes = parseInt(parts[2], 10);
    const period = parts[3].toUpperCase();

    // Convert to 24-hour format
    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }

    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date.getTime();
  }

  /**
   * Convert HH:MM time string to timestamp (milliseconds)
   * Uses today's date with the specified time
   */
  private convertTimeToTimestamp(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0); // Set hours, minutes, seconds=0, milliseconds=0
    return date.getTime();
  }

  /**
   * Presentation logic: Get formatted time value for input (HH:MM format)
   * Converts timestamp to HH:MM format for the time input
   */
  getFormattedTimeValue(): string {
    // Convert field value (timestamp) to HH:MM format for input
    if (!this.field.value) return '';

    const timeValue = this.field.value;

    // If it's a timestamp (number), convert to HH:MM
    if (typeof timeValue === 'number') {
      const date = new Date(timeValue);
      if (!isNaN(date.getTime())) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
      }
    }

    // Fallback to empty string
    return '';
  }

  /**
   * Check if a time value is selected
   */
  hasTimeValue(): boolean {
    if (!this.field.value) return false;
    if (typeof this.field.value === 'number') {
      return !isNaN(new Date(this.field.value).getTime());
    }
    return false;
  }

  /**
   * Presentation logic: Get display time value for readonly view
   * Converts timestamp to 12-hour format with AM/PM for display
   */
  getDisplayTimeValue(): string {
    // Convert field value (timestamp) to 12-hour format with AM/PM for display
    if (!this.field.value) return '';

    const timeValue = this.field.value;

    // If it's a timestamp (number), convert to 12-hour format
    if (typeof timeValue === 'number') {
      const date = new Date(timeValue);
      if (!isNaN(date.getTime())) {
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const minutesStr = minutes.toString().padStart(2, '0');
        return `${hour12}:${minutesStr} ${ampm}`;
      }
    }

    // Fallback to empty string
    return '';
  }

  /**
   * Presentation logic: Focus time input and show picker
   */
  focusTimeInput(event: Event): void {
    const target = event.target as HTMLElement;
    const input = target.closest('mat-form-field')?.querySelector('input[type="time"]') as HTMLInputElement;
    if (input && !this.isFieldReadOnly()) {
      input.focus();
      input.showPicker?.(); // Show native time picker if available
    }
  }

  /**
   * Presentation logic: Check if field is required
   */
  isFieldRequired(): boolean {
    return this.field.required || false;
  }

  /**
   * Presentation logic: Check if field is read-only
   */
  isSecured(): boolean {
    return this.field.attributeValues?.['isSecured'] === true;
  }

  isFieldReadOnly(): boolean {
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

  /**
   * Presentation logic: Get placeholder text
   */
  getPlaceholder(): string {
    if (this.isFieldReadOnly()) {
      return '';
    }
    return 'HH:MM';
  }

  // FieldValidation interface implementation
  validateField(): string | null {
    const { isValid, errorMessage } = this.kristaFieldService.validateField(this.field as any, this.field?.value);
    return isValid ? null : (errorMessage || VALIDATION_MESSAGES.enterCorrectValues);
  }

  isFieldEmpty(): boolean {
    return !this.field.value || this.field.value.toString().trim() === '';
  }
}
