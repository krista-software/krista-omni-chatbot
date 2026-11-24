import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { MatSelect } from '@angular/material/select';
import { FormField } from '../../../models/message.model';
import { BasicFieldConfig } from '../../../models/field-config.model';
import { getFieldLabel } from '../shared/field-label.utils';

/**
 * Self-contained pick-many (checkbox) field component.
 * This component handles options parsing and display internally,
 * making it library-ready with minimal parent dependencies.
 */
@Component({
  selector: 'app-pick-many-field',
  templateUrl: './pick-many-field.component.html',
  styleUrls: ['./pick-many-field.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class PickManyFieldComponent implements OnChanges {
  // Data inputs
  @Input() field!: FormField;
  @Input() config: BasicFieldConfig = {
    hasError: false,
    errorMessage: '',
    readOnly: false
  };

  // Event outputs
  @Output() valueChange = new EventEmitter<any[]>();

  // Search/filter for dropdown mode
  searchText: string = '';
  filteredOptions: Array<{value: any, label: string}> = [];

  @ViewChild('readonlySelect') readonlySelect!: MatSelect;

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
   * Get cached options for pick-many field
   */
  get options(): Array<{value: any, label: string}> {
    return this._cachedOptions;
  }

  /**
   * Whether to render as dropdown (when options exceed threshold)
   */
  get useDropdown(): boolean {
    return this._cachedOptions.length > PickManyFieldComponent.DROPDOWN_THRESHOLD;
  }

  /**
   * Calculate options for pick-many field
   * Handles multiple possible locations for options and readonly filtering
   */
  private calculateOptions(): Array<{value: any, label: string}> {
    let allOptions: any[] = [];

    // Check multiple possible locations for options
    if (this.field.attributeValues?.['options'] && Array.isArray(this.field.attributeValues['options'])) {
      allOptions = this.field.attributeValues['options'].map((option: any) => ({
        value: option,
        label: option
      }));
    }
    else if (this.field.options && Array.isArray(this.field.options)) {
      allOptions = this.field.options.map((option: any) => ({
        value: option,
        label: option
      }));
    }
    else if (this.field.options && typeof this.field.options === 'object') {
      const optionsArray = Object.values(this.field.options);
      if (optionsArray.length > 0 && Array.isArray(optionsArray[0])) {
        allOptions = optionsArray[0].map((option: any) => ({
          value: option,
          label: option
        }));
      }
    }

    // original app behavior: In readonly mode, only show the selected values
    if (this.isFieldReadOnly()) {
      if (this.field.value && Array.isArray(this.field.value) && this.field.value.length > 0) {
        // If we have options, filter by selected values
        if (allOptions.length > 0) {
          return allOptions.filter(option => this.field.value.includes(option.value));
        }
        // If no options available (e.g., in entity table), use selected values directly
        return this.field.value.map((val: any) => ({
          value: val,
          label: typeof val === 'string' ? val : String(val)
        }));
      } else {
        // No selection in readonly mode
        return [];
      }
    }

    return allOptions;
  }

  /**
   * Handle multi-select dropdown change
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
   * Get display text for selected values
   */
  getSelectedLabels(): string {
    const values = this.field.value;
    if (!values || !Array.isArray(values) || values.length === 0) return '';
    const labels = values.map((v: any) => {
      const found = this._cachedOptions.find(o => o.value === v);
      return found ? found.label : v;
    });
    return labels.join(', ');
  }

  /**
   * Get trigger display text: shows first selected label + count of others
   * e.g. "Option1 (+6 others)"
   */
  getTriggerText(): string {
    const values = this.field.value;
    if (!values || !Array.isArray(values) || values.length === 0) return '';
    const firstValue = values[0];
    const found = this._cachedOptions.find(o => o.value === firstValue);
    const firstLabel = found ? found.label : firstValue;
    if (values.length === 1) return firstLabel;
    return `${firstLabel} (+${values.length - 1} others)`;
  }

  /**
   * Open the hidden readonly mat-select overlay
   */
  openReadonlyDropdown(): void {
    if (this.readonlySelect) {
      this.readonlySelect.open();
    }
  }

  /**
   * Check if field has selected values
   */
  hasValue(): boolean {
    return Array.isArray(this.field.value) && this.field.value.length > 0;
  }

  /**
   * Clear all selections
   */
  clearSelection(event: Event): void {
    event.stopPropagation();
    this.searchText = '';
    this.filteredOptions = [...this._cachedOptions];
    this.valueChange.emit([]);
    this.cdr.markForCheck();
  }

  /**
   * Handle checkbox change
   */
  onCheckboxChange(optionValue: any, checked: boolean): void {
    let currentValues = this.field.value || [];
    if (!Array.isArray(currentValues)) {
      currentValues = [];
    }

    if (checked) {
      if (!currentValues.includes(optionValue)) {
        currentValues = [...currentValues, optionValue];
      }
    } else {
      currentValues = currentValues.filter((value: any) => value !== optionValue);
    }

    this.valueChange.emit(currentValues);
  }

  /**
   * Check if option is selected
   */
  isOptionSelected(optionValue: any): boolean {
    const currentValues = this.field.value || [];
    return Array.isArray(currentValues) && currentValues.includes(optionValue);
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
