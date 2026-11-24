import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef, OnChanges, SimpleChanges } from '@angular/core';
import { FormField } from '../../../models/message.model';
import { BasicFieldConfig } from '../../../models/field-config.model';
import { getFieldLabel } from '../shared/field-label.utils';

/**
 * Self-contained pick-one (radio) field component.
 * This component handles options parsing and display internally,
 * making it library-ready with minimal parent dependencies.
 */
@Component({
  selector: 'app-pick-one-field',
  templateUrl: './pick-one-field.component.html',
  styleUrls: ['./pick-one-field.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class PickOneFieldComponent implements OnChanges {
  // Data inputs
  @Input() field!: FormField;
  @Input() config: BasicFieldConfig = {
    hasError: false,
    errorMessage: '',
    readOnly: false
  };

  // Event outputs
  @Output() valueChange = new EventEmitter<any>();

  // Search/filter for dropdown mode
  searchText: string = '';
  filteredOptions: Array<{value: any, label: string}> = [];

  // Cached options to prevent re-renders
  private _cachedOptions: Array<{value: any, label: string}> = [];
  private _lastFieldOptions: any = null;
  private _lastReadOnlyState: boolean = false;
  private _lastFieldValue: any = null;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    // Recalculate options only when field.options, config.readOnly, or field.value changes
    if (changes['field'] || changes['config']) {
      const currentOptions = this.field.attributeValues?.['options'] || this.field.options;
      const currentReadOnly = this.isFieldReadOnly();
      const currentValue = this.field.value;

      // Check if we need to recalculate
      if (currentOptions !== this._lastFieldOptions ||
          currentReadOnly !== this._lastReadOnlyState ||
          currentValue !== this._lastFieldValue) {
        this._lastFieldOptions = currentOptions;
        this._lastReadOnlyState = currentReadOnly;
        this._lastFieldValue = currentValue;
        this._cachedOptions = this.calculateOptions();
        this.filteredOptions = [...this._cachedOptions];
      }
    }
  }

  private static readonly DROPDOWN_THRESHOLD = 5;

  /**
   * Get cached options for pick-one field
   */
  get options(): Array<{value: any, label: string}> {
    return this._cachedOptions;
  }

  /**
   * Whether to render as dropdown (when options exceed threshold)
   */
  get useDropdown(): boolean {
    return this._cachedOptions.length > PickOneFieldComponent.DROPDOWN_THRESHOLD;
  }

  /**
   * Calculate options for pick-one field
   * Handles multiple possible locations for options and readonly filtering
   */
  private calculateOptions(): Array<{value: any, label: string}> {
    let allOptions: any[] = [];

    // 1. Check attributeValues.options (most common for pick one/many fields)
    if (this.field.attributeValues?.['options'] && Array.isArray(this.field.attributeValues['options'])) {
      allOptions = this.field.attributeValues['options'].map((option: any) => ({
        value: option,
        label: option
      }));
    }
    // 2. Check direct options property as array
    else if (this.field.options && Array.isArray(this.field.options)) {
      allOptions = this.field.options.map((option: any) => ({
        value: option,
        label: option
      }));
    }
    // 3. Check if options is an object with nested structure
    else if (this.field.options && typeof this.field.options === 'object') {
      const optionsArray = Object.values(this.field.options);
      if (optionsArray.length > 0 && Array.isArray(optionsArray[0])) {
        allOptions = optionsArray[0].map((option: any) => ({
          value: option,
          label: option
        }));
      }
    }

    // original app behavior: In readonly mode, only show the selected value
    if (this.isFieldReadOnly()) {
      if (this.field.value) {
        // Only return the selected option in readonly mode
        return allOptions.filter(option => option.value === this.field.value);
      } else {
        // No selection in readonly mode
        return [];
      }
    }

    return allOptions;
  }

  /**
   * Handle radio button change
   */
  onRadioChange(value: any): void {
    this.valueChange.emit(value);
  }

  /**
   * Clear the selected value
   */
  clearSelection(event: Event): void {
    event.stopPropagation();
    this.valueChange.emit(null);
  }

  /**
   * Check if field has a selected value
   */
  hasValue(): boolean {
    return this.field.value !== null && this.field.value !== undefined && this.field.value !== '';
  }

  /**
   * Readonly display text: the label of the selected option, falling back to the
   * raw value when no matching option is present. Mirrors pick-many's
   * getSelectedLabels().
   */
  getSelectedLabel(): string {
    if (!this.hasValue()) {
      return '';
    }
    const found = this._cachedOptions.find(option => option.value === this.field.value);
    return found ? found.label : String(this.field.value);
  }

  /**
   * Handle dropdown selection change
   */
  onDropdownChange(event: any): void {
    this.valueChange.emit(event.value);
  }

  /**
   * Reset search when select panel opens/closes
   */
  onSelectOpenedChange(opened: boolean): void {
    if (!opened) {
      this.searchText = '';
      this.filteredOptions = [...this._cachedOptions];
      this.cdr.markForCheck();
    }
  }

  /**
   * Filter options based on search text
   */
  filterOptions(searchText: string): void {
    this.searchText = searchText;
    if (!searchText) {
      this.filteredOptions = [...this._cachedOptions];
    } else {
      const lower = searchText.toLowerCase();
      this.filteredOptions = this._cachedOptions.filter(
        option => option.label.toLowerCase().includes(lower)
      );
    }
    this.cdr.markForCheck();
  }

  /**
   * Check if option is selected
   */
  isOptionSelected(optionValue: any): boolean {
    return this.field.value === optionValue;
  }

  /**
   * Check if field is required
   */
  isFieldRequired(): boolean {
    return this.field.required || false;
  }

  isSecured(): boolean {
    return this.field.attributeValues?.['isSecured'] === true;
  }

  /**
   * Check if field is read-only
   */
  isFieldReadOnly(): boolean {
    return this.config.readOnly || this.field.readOnly || false;
  }

  /**
   * Check if label should be shown
   * Defaults to true if not specified in config
   */
  shouldShowLabel(): boolean {
    return this.config.showLabel !== false; // Show by default unless explicitly set to false
  }

  /**
   * Get field label with i18n support
   * Uses shared utility function for consistency across all field types
   */
  getFieldLabel(): string {
    return getFieldLabel(this.field);
  }

  /**
   * TrackBy function for ngFor to prevent unnecessary re-renders
   */
  trackByValue(index: number, option: {value: any, label: string}): any {
    return option.value;
  }
}
