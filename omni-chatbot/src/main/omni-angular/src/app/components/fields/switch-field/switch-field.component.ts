import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormField } from '../../../models/message.model';
import { BasicFieldConfig } from '../../../models/field-config.model';
import { getFieldLabel } from '../shared/field-label.utils';

/**
 * Self-contained switch (toggle) field component.
 * This component handles switch display and interaction internally,
 * making it library-ready with minimal parent dependencies.
 */
@Component({
  selector: 'app-switch-field',
  templateUrl: './switch-field.component.html',
  styleUrls: ['./switch-field.component.css'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SwitchFieldComponent implements OnInit {
  // Data inputs
  @Input() field!: FormField;
  @Input() config: BasicFieldConfig = {
    hasError: false,
    errorMessage: '',
    readOnly: false
  };

  // Event outputs
  @Output() valueChange = new EventEmitter<boolean>();

  ngOnInit(): void {
    // Initialize switch field value to false if not set
    // Ensures switch field always has a boolean value
    if (this.field.value === null || this.field.value === undefined) {
      this.field.value = false;
      this.valueChange.emit(false);
    }
  }

  /**
   * Handle toggle click
   */
  onToggleClick(): void {
    if (!this.isFieldReadOnly()) {
      // Ensure we're working with a boolean value
      const currentValue = !!this.field.value;
      const newValue = !currentValue;
      this.valueChange.emit(newValue);
    }
  }

  /**
   * Get current boolean value
   */
  getCurrentValue(): boolean {
    return !!this.field.value;
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
}
