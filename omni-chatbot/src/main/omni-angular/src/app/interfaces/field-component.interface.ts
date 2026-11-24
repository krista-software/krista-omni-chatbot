import { EventEmitter } from '@angular/core';
import { FormField } from '../models/form-field.model';

/**
 * Base interface for all field components
 * Ensures consistency across all field implementations
 */
export interface IFieldComponent {
  // Required inputs
  field: FormField;
  hasError: boolean;
  errorMessage: string;

  // Required outputs
  valueChange: EventEmitter<any>;

  // Required methods
  isFieldRequired(): boolean;
  isFieldReadOnly(): boolean;
}

/**
 * Extended interface for text-based field components
 */
export interface ITextFieldComponent extends IFieldComponent {
  keyPress?: EventEmitter<KeyboardEvent>;
  getPlaceholder(): string;
  getFieldType?(): string;
}

/**
 * Extended interface for option-based field components (Pick One, Pick Many)
 */
export interface IOptionFieldComponent extends IFieldComponent {
  getFieldOptions(): Array<{ value: any; label: string }>;
}

/**
 * Extended interface for date/time field components
 */
export interface IDateTimeFieldComponent extends IFieldComponent {
  getPlaceholder(): string;
}

/**
 * Extended interface for file field components
 */
export interface IFileFieldComponent extends IFieldComponent {
  getAcceptedFileTypes(): string;
  hasFile(): boolean;
  getFileName(): string;
  getFileSize(): string;
}

/**
 * Extended interface for rating field components
 */
export interface IRatingFieldComponent extends IFieldComponent {
  stars: number[];
  isStarFilled(starIndex: number): boolean;
}

/**
 * Field component configuration
 */
export interface FieldComponentConfig {
  component: any;
  selector: string;
  fieldTypes: string[];
}

/**
 * Field validation result
 */
export interface FieldValidationResult {
  isValid: boolean;
  errorMessage?: string;
}

/**
 * Field option structure
 */
export interface FieldOption {
  value: any;
  label: string;
  disabled?: boolean;
}
