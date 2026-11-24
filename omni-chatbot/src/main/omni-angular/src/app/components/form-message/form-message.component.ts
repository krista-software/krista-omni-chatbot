import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectorRef, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { FieldTypes } from '../../models/message.model';
import { FOCUSABLE_FIELD_TYPES, FieldType } from '../../config/field-types.constant';
import { parsePhoneNumber } from 'libphonenumber-js';

// Import from UI Toolkit (will be replaced by library in future)
import { KSDKMessage, SubmitType, FormField, MessageType } from '../../../ui-toolkit-src-angular';
import { TextFieldConfig, BasicFieldConfig, AddressFieldConfig, LocationFieldConfig, FileFieldConfig, RichTextFieldConfig } from '../../models/field-config.model';
// KristaField imports
import { KristaField } from '../../models/krista-field.model';
// Facade and Services
import { FormFacade } from '../../core/facades';
import { FieldTypeService } from '../../services/field-type.service';
import { KristaFieldService } from '../../services/krista-field.service';
import { KristaFieldFactoryService } from '../../services/krista-field-factory.service';
import { QueryParamsManagerService } from '../../services/core/query-params-manager.service';
import { getAcceptAttribute } from '../../utils/file-validation.util';

@Component({
  selector: 'app-form-message',
  standalone: false,
  templateUrl: './form-message.component.html',
  styleUrl: './form-message.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FormMessageComponent implements OnInit, OnDestroy {
  @Input() message!: KSDKMessage;
  @Input() errorFields: string[] = [];
  @Input() errorMessages: string[] = [];
  @Input() isWelcomeMessage: boolean = false;

  @Output() sendFormData = new EventEmitter<{submitType: SubmitType, submitValue: string}>();

  isSubmitting = false;
  isFormSubmittedSuccessfully = false; // Track if form has been successfully submitted
  formFields: FormField[] = [];
  hasAttemptedSubmit = false; // Track if form has been submitted to show validation errors
  submittedPath: string | undefined; // Track which path was submitted
  frozenByTimer = false; // Track if form was frozen by ephemeral timer expiry
  timerExpired = false; // Track if timer already expired (for history messages)
  ephemeralTime: { start: number; end: number } | undefined;

  // KristaField instances for validation and formatting
  kristaFields: Map<string, KristaField> = new Map();

  // Track which fields are currently focused (for percentage field display)
  focusedFields: Set<string> = new Set();

  constructor(
    private cdr: ChangeDetectorRef,
    private formFacade: FormFacade,
    private kristaFieldService: KristaFieldService,
    private kristaFieldFactory: KristaFieldFactoryService,
    public fieldTypeService: FieldTypeService,
    private queryParamsManager: QueryParamsManagerService
  ) {}

  ngOnInit(): void {
    this.initializeFormFields();
    this.initializeSubmittedPath();
    this.initializeEphemeralTimer();
    this.fillAndSendForm();
  }

  /**
   * Pre-populate form fields from URL query parameters and auto-submit.
   * Matches original's FormMessageComponent.fillAndSendForm().
   * Only runs for welcome messages with non-readonly forms.
   */
  private fillAndSendForm(): void {
    if (!this.isWelcomeMessage || this.message.form?.readOnly) {
      return;
    }

    const queryParams = this.queryParamsManager.getQueryParams();
    if (!queryParams || Object.keys(queryParams).length === 0) {
      return;
    }

    let formWasAutoFilled = false;

    this.formFields.forEach(field => {
      const fieldId = field.fieldId || field.name;
      const valueFromQuery = queryParams[fieldId];

      if (valueFromQuery != null && valueFromQuery !== '') {
        field.value = valueFromQuery;

        const kristaField = this.kristaFields.get(field.name);
        if (kristaField) {
          kristaField.setValue(valueFromQuery);
        }

        formWasAutoFilled = true;
      }
    });

    if (formWasAutoFilled) {
      // Clear query params so subsequent forms don't auto-fill/submit
      this.queryParamsManager.clearQueryParams();
      this.cdr.markForCheck();
      // Delay to let the form render on the left first, then auto-submit
      setTimeout(() => {
        this.sendFormData.emit({
          submitType: SubmitType.submit,
          submitValue: ''
        });
      }, 500);
    }
  }

  /**
   * Initialize submittedPath from message.submit if it exists
   * This is used when loading message history to show which path was previously selected
   */
  private initializeSubmittedPath(): void {
    // Case-insensitive comparison since API returns uppercase 'PATH' but enum is lowercase 'path'
    if (this.message.submit?.type?.toLowerCase() === SubmitType.path && this.message.submit.value) {
      this.submittedPath = this.message.submit.value;
    }
  }

  private initializeEphemeralTimer(): void {
    if (this.message.messageType === MessageType.Ask && !this.message.submit && !this.message.form?.readOnly && this.message.timer) {
      this.ephemeralTime = {
        start: this.message.timer.startTime,
        end: this.message.timer.endTime
      };
    } else if (this.message.messageType === MessageType.Ask && this.message.form?.readOnly && this.message.timer) {
      this.timerExpired = true;
    }
  }

  onFreezeInput(frozen: boolean): void {
    this.frozenByTimer = frozen;
    if (frozen) {
      // Auto-submit the form when timer expires
      this.onSubmitForm();
    }
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  private initializeFormFields(): void {
    if (this.message.form?.pages) {
      this.formFields = [];
      this.kristaFields.clear();

      this.message.form.pages.forEach(page => {
        if (page.fields) {
          page.fields.forEach(field => {
            // Initialize field value if not set or empty string
            if (field.value === undefined || field.value === null || field.value === '') {
              field.value = this.getDefaultFieldValue(field);
            }

            // For File and Camera fields, if the value is a File object, clear it
            // File objects cannot be used with KristaFieldFactory
            const isFileField = field.fieldType === 'com.krista.fields.File' ||
                                field.fieldType === 'com.krista.fields.Camera';

            if (isFileField && field.value instanceof File) {
              field.value = null;
            }

            // Create KristaField instance for this field
            const kristaField = this.kristaFieldFactory.create(field);
            this.kristaFields.set(field.name, kristaField);
          });
          this.formFields.push(...page.fields);
        }
      });
    }
  }

  /**
   * Get default value for a field based on its type
   */
  private getDefaultFieldValue(field: FormField): any {
    switch (field.fieldType) {
      case 'com.krista.fields.Text':
      case 'com.krista.fields.Email':
      case 'com.krista.fields.Phone':
      case 'com.krista.fields.Paragraph':
      case 'com.krista.fields.Date':
      case 'com.krista.fields.Time':
      case 'com.krista.fields.Location':
      case 'com.krista.fields.Street':
      case 'com.krista.fields.Street2':
      case 'com.krista.fields.City':
      case 'com.krista.fields.State':
      case 'com.krista.fields.Country':
      case 'com.krista.fields.PostalCode':
      case 'com.krista.fields.Address':
        return '';

      case 'com.krista.fields.Number':
      case 'com.krista.fields.Currency':
      case 'com.krista.fields.Unit':
      case 'com.krista.fields.Percentage':
      case 'com.krista.fields.PickOne':
        return '';

      case 'com.krista.fields.PickMany':
      case 'com.krista.fields.Checkboxes':
        return [];

      case 'com.krista.fields.MultiField':
      case 'com.krista.fields.Composite':
        return {};

      case 'com.krista.fields.Switch':
        const defaultValue = field.options?.['defaultValue']?.value;
        return defaultValue?.expression === 'true';

      case 'com.krista.fields.File':
      case 'com.krista.fields.Rating':
        return null;

      default:
        return '';
    }
  }

  get messageText(): string {
    return this.message.userMessage || '';
  }

  /**
   * Hide message text on the split (RIGHT) message.
   * Matches original: hideMessage = message.isSplit && message.isAnswered && !message.isIncoming && form && form.readOnly
   */
  get hideMessage(): boolean {
    const form = this.message.form;
    return !!(
      this.message.isSplit &&
      this.message.isAnswered &&
      !this.message.isIncoming &&
      form &&
      form.readOnly
    );
  }

  /**
   * Hide form fields on the original (LEFT) message after submission.
   * Matches original: hideForm = message.isAnswered && form && form.readOnly && message.isIncoming && (message.hasValidForm || message.hasPath)
   */
  get hideForm(): boolean {
    const form = this.message.form;
    return !!(
      this.message.isAnswered &&
      form &&
      form.readOnly &&
      this.message.isIncoming &&
      (this.message.hasValidForm || this.message.hasPath)
    );
  }

  get showForm(): boolean {
    return !this.hideForm && !this.message.form?.hideForm && this.formFields.length > 0;
  }

  /**
   * Auto-focus the first field when an editable form first renders (mirrors the
   * 2.0.17 behavior). Only the first field of an editable form is a candidate,
   * and only when its type is in FOCUSABLE_FIELD_TYPES (same list the React app
   * used).
   */
  shouldAutoFocus(index: number): boolean {
    if (index !== 0 || !this.showForm) {
      return false;
    }
    const firstField = this.formFields[0];
    if (this.isFieldReadOnly(firstField)) {
      return false;
    }
    return FOCUSABLE_FIELD_TYPES.includes(firstField.fieldType as FieldType);
  }

  get showSendButton(): boolean {
    // Hide send button when:
    // 1. Message is no longer in Ask state (already answered/submitted)
    // 2. Message already has a submit (from history - already answered)
    // 3. Form was successfully submitted locally
    // 4. Timer expired (ephemeral)
    if (this.message.messageType !== MessageType.Ask) {
      return false;
    }
    if (this.message.submit) {
      return false;
    }
    return this.canShowSendButton &&
           !this.isFormSubmittedSuccessfully &&
           !this.frozenByTimer;
  }

  get canShowSendButton(): boolean {
    // Check message.paths (not form.paths)
    const messageForm = this.message.form;
    return !!(messageForm &&
             !messageForm.readOnly &&
             (!this.message.paths || this.message.paths.length === 0) &&
             !this.isFormNoAnswer);
  }

  get isFormNoAnswer(): boolean {
    // Check if form has no-answer submit type (matches original app logic)
    return this.message.submit?.type === SubmitType.no_answer;
  }

  get isButtonDisabled(): boolean {
    // Match original app logic: disabled when submitting OR when form conditions don't allow submission
    return this.isSubmitting ||
           !this.canShowSendButton ||
           this.message.form?.readOnly === true ||
           this.message.messageType !== MessageType.Ask ||
           this.isFormSubmittedSuccessfully; // Disable button after successful submission
  }

  get isFormSubmitted(): boolean {
    // Show submitted indicator when form is in answered state (after submission) OR locally submitted
    return (this.message.messageType === MessageType.Answered || !!this.isFormSubmittedSuccessfully) &&
           !!this.message.form &&
           !this.isFormNoAnswer;
  }

  get showPaths(): boolean {
    return !this.hideForm && !this.message.form?.hideForm &&
           !!(this.message.paths && this.message.paths.length > 0);
  }

  onPathClick(event: { type: SubmitType; path: string }): void {
    this.submittedPath = event.path;
    this.isFormSubmittedSuccessfully = true;

    // Emit the path selection to parent with the path name as submitValue
    this.sendFormData.emit({
      submitType: event.type,
      submitValue: event.path // Pass the path name as submitValue
    });

    // Trigger change detection
    this.cdr.markForCheck();
  }

  onFieldValueChange(fieldName: string, value: any): void {
    const field = this.formFields.find(f => f.name === fieldName);
    if (field) {
      // For File, Camera, List, and Table fields, bypass Angular KristaField wrapper and set value directly
      // These fields handle their own formatting and validation
      const isBypassField = field.fieldType === 'com.krista.fields.File' ||
                            field.fieldType === 'com.krista.fields.Camera' ||
                            field.fieldType === 'com.krista.fields.List' ||
                            field.fieldType === 'com.krista.fields.Table';

      if (isBypassField) {
        // Set value directly without formatting
        field.value = value;

        // Update Angular KristaField wrapper for validation only (don't format)
        const kristaField = this.kristaFields.get(fieldName);
        if (kristaField) {
          // Directly set the internal value without triggering formatting
          (kristaField as any)._value = value;

          // Clear errors if value is present
          const isEmpty = !value ||
                         (typeof value === 'object' && value.name && value.type) ||
                         (Array.isArray(value) && value.length === 0);

          if (!isEmpty) {
            (kristaField as any)._errors = [];
          }
        }
      } else {
        // Update KristaField (it will handle formatting and validation)
        const kristaField = this.kristaFields.get(fieldName);
        if (kristaField) {
          kristaField.setValue(value);
          // Sync formatted value back to FormField
          field.value = kristaField.value;
        } else {
          // Fallback for fields not yet migrated to KristaField
          field.value = value;
        }
      }
    }
  }







  /**
   * Format phone number as user types (matches original app behavior)
   */
  formatPhoneNumber(value: string): string {
    if (!value) return '';

    try {
      // Try to parse and format the phone number
      const phoneNumber = parsePhoneNumber(value);
      if (phoneNumber) {
        // Return formatted national number for better UX
        return phoneNumber.formatNational();
      }
    } catch (error) {
      // If parsing fails, return the original value
    }

    return value;
  }

  /**
   * Handle phone field blur event - format the phone number
   */
  onPhoneFieldBlur(field: FormField, value: string): void {
    if (field.fieldType === 'com.krista.fields.Phone' && value && !this.isFieldReadOnly(field)) {
      const formattedValue = this.formatPhoneNumber(value);
      if (formattedValue !== value) {
        field.value = formattedValue;
      }
    }
  }

  /**
   * Check if percentage field has % symbol in its value
   */
  hasPercentageSymbol(field: FormField): boolean {
    return field.fieldType === 'com.krista.fields.Percentage' &&
           field.value &&
           field.value.toString().includes('%');
  }

  /**
   * Get the display value for a field, handling currency and percentage formatting
   */
  getDisplayValue(field: FormField): string {
    if (!field.value && field.value !== 0) {
      return '';
    }

    const value = field.value.toString();

    // For percentage fields: show % when readonly (API values) or after blur
    if (field.fieldType === 'com.krista.fields.Percentage') {
      if (this.isFieldReadOnly(field)) {
        // API value might be in decimal format (0.23) - convert to percentage (23%)
        // Check if value is already a percentage string with %
        if (value.includes('%')) {
          return value;
        }
        // Check if value is a decimal (less than 1 and not a whole number like 0)
        const numValue = parseFloat(value);
        if (!isNaN(numValue) && Math.abs(numValue) < 1 && numValue !== 0) {
          // Convert decimal to percentage (0.23 -> 23%)
          return `${(numValue * 100).toFixed(0)}%`;
        }
        // Otherwise show as-is with %
        return `${value}%`;
      } else {
        // User input - show value as-is (may include % after blur)
        return value;
      }
    }

    // For currency fields: always show raw number (no $ symbol)
    if (field.fieldType === 'com.krista.fields.Currency') {
      return value.replace('$', '');
    }

    // For other fields, return as-is
    return value;
  }

  onSubmitForm(): void {
    if (this.isSubmitting) {
      return;
    }

    // Mark that form submission has been attempted
    this.hasAttemptedSubmit = true;

    // Validate all fields
    const hasErrors = this.validateAllFields();

    if (hasErrors) {
      // Don't submit if validation fails - no loader should be shown
      // Scroll to the first invalid field after DOM updates with error classes
      setTimeout(() => {
        const firstErrorField = document.querySelector('.field-error');
        if (firstErrorField) {
          firstErrorField.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
      });
      return;
    }

    // Sync KristaField values back to FormField before submission
    // Skip List/Table fields as they manage their own values
    this.kristaFields.forEach((kristaField, fieldName) => {
      const field = this.formFields.find(f => f.name === fieldName);
      if (field &&
          field.fieldType !== 'com.krista.fields.List' &&
          field.fieldType !== 'com.krista.fields.Table') {
        kristaField.syncToFormField();
      }
    });

    // Strip empty rows from List fields (both standalone and inside Table rows)
    // so empty rows are never submitted to the backend
    this.formFields.forEach(field => {
      if (field.fieldType === FieldTypes.LIST_FIELD && Array.isArray(field.value)) {
        field.value = this.filterEmptyListRows(field.value, field.attributeValues?.['field']);
      }
      if (field.fieldType === 'com.krista.fields.Table' && field.value?.['rows']) {
        const meta = field.attributeValues?.['meta'];
        const metaColumns = meta?.['columns'] || [];
        for (const row of field.value['rows']) {
          for (const col of metaColumns) {
            const colField = col.field || col;
            if ((colField.fieldType === FieldTypes.LIST_FIELD) && Array.isArray(row[colField.name])) {
              row[colField.name] = this.filterEmptyListRows(row[colField.name], colField.attributeValues?.['field']);
            }
          }
        }
      }
    });

    // Apply EntityReference transformations to formFields in place
    // so message-bubble picks up the correct values with meta (entityType, primaryKey).
    // Without meta, the backend cannot resolve EntityMeta and throws NPE on getPrimaryKey().
    this.formFields.forEach(field => {
      if (field.fieldType === FieldTypes.ENTITY_FIELD) {
        const kristaValue = this.kristaFieldService.getKristaValue(field, field.value);
        field.value = this.transformEntityReferenceValue(field, kristaValue);
      }

      // Also transform entity rows inside List fields (matching original behavior).
      // original EntityValue.toResponse() always includes meta for entity objects
      // regardless of whether the entity is a top-level field or inside a list row.
      if (field.fieldType === FieldTypes.LIST_FIELD) {
        const columnField = field.attributeValues?.['field'];
        if (columnField?.fieldType === FieldTypes.ENTITY_FIELD && Array.isArray(field.value)) {
          field.value = field.value.map((row: any) => {
            if (row && row.fields) {
              // Use the column field's entityDefinition for the transformation
              const tempEntityField: FormField = {
                fieldId: field.fieldId || field.name,
                name: field.name,
                fieldType: FieldTypes.ENTITY_FIELD,
                attributeValues: columnField.attributeValues
              };
              return this.transformEntityReferenceValue(tempEntityField, row);
            }
            return row;
          });
        }
      }
    });

    // Only set submitting state (show loader) if validation passes
    this.isSubmitting = true;
    this.sendFormData.emit({
      submitType: SubmitType.submit,
      submitValue: '' // Empty string for form submissions (form fields are in the message.form)
    });

    // Mark form as successfully submitted immediately
    // This will disable all fields to prevent further editing
    this.isFormSubmittedSuccessfully = true;

    // Reset submitting state after a delay
    setTimeout(() => {
      this.isSubmitting = false;
      // Mark for check to ensure UI updates
      this.cdr.markForCheck();
    }, 1000);
  }

  /**
   * Validate all form fields and return true if there are errors
   */
  private validateAllFields(): boolean {
    let hasErrors = false;

    this.formFields.forEach(field => {
      // For Table fields, validate all cells in all rows
      if (field.fieldType === 'com.krista.fields.Table') {
        const tableValidation = this.validateTableField(field);
        if (!tableValidation.isValid) {
          hasErrors = true;
          // Mark the table's KristaField as invalid so error shows in UI
          const kristaField = this.kristaFields.get(field.name);
          if (kristaField) {
            kristaField.markAsTouched();
            const errorMsg = tableValidation.noRows
              ? 'Please add at least one row.'
              : 'Please fix the errors in the table.';
            (kristaField as any)._errors = [errorMsg];
          }
        } else {
          // Clear errors if table is now valid
          const kristaField = this.kristaFields.get(field.name);
          if (kristaField) {
            (kristaField as any)._errors = [];
          }
        }
        return; // Skip normal validation for table fields
      }

      // For List fields, validate list-level required and individual cell contents
      if (field.fieldType === 'com.krista.fields.List') {
        // Validate list-level required (must have rows)
        const kristaField = this.kristaFields.get(field.name);
        if (kristaField) {
          kristaField.markAsTouched();
          if (!kristaField.validate()) {
            hasErrors = true;
          }
        }
        // Validate individual cell contents
        if (!this.validateListField(field)) {
          hasErrors = true;
        }
        return; // Skip normal validation for list fields
      }

      // For File and Camera fields, validate directly from field.value
      // because we bypass KristaField formatting for these fields
      const isFileField = field.fieldType === 'com.krista.fields.File' ||
                          field.fieldType === 'com.krista.fields.Camera';

      if (isFileField) {
        // Validate file field manually
        if (field.required) {
          const value = field.value;
          let isEmpty = false;

          // File fields send arrays, Camera fields send single objects
          if (field.fieldType === 'com.krista.fields.File') {
            // File field: accept array with mediaId or fileName, string values, or objects with fileName
            if (!value) {
              isEmpty = true;
            } else if (Array.isArray(value)) {
              isEmpty = value.length === 0 || !(value[0]?.mediaId || value[0]?.fileName || value[0]?.name);
            } else if (typeof value === 'string') {
              isEmpty = value.trim() === '';
            } else if (typeof value === 'object') {
              isEmpty = !(value.mediaId || value.fileName || value.filename || value.name);
            } else {
              isEmpty = true;
            }
          } else {
            // Camera field: expect single object with mediaId or filename
            isEmpty = !value || (typeof value === 'object' && !value.mediaId && !value.filename);
          }

          if (isEmpty) {
            hasErrors = true;
            // Mark the KristaField as touched and set error
            const kristaField = this.kristaFields.get(field.name);
            if (kristaField) {
              kristaField.markAsTouched();
              (kristaField as any)._errors = ['This field is required.'];
            }
          } else {
            // Clear errors if file is present
            const kristaField = this.kristaFields.get(field.name);
            if (kristaField) {
              kristaField.markAsTouched();
              (kristaField as any)._errors = [];
            }
          }
        }
      } else {
        // Use KristaField validation for other fields
        const kristaField = this.kristaFields.get(field.name);
        if (kristaField) {
          // Mark field as touched so errors will be visible
          kristaField.markAsTouched();

          // Validate the field
          if (!kristaField.validate()) {
            hasErrors = true;
          }
        }
      }

      // For MultiField/Composite fields, also validate all sub-fields (including nested ones)
      if (this.isMultiField(field)) {
        if (!this.validateMultiFieldSubFields(field)) {
          hasErrors = true;
        }
      }
    });

    // Mark for check to update UI with validation errors in next cycle
    // Use markForCheck instead of detectChanges to avoid recreating child components
    this.cdr.markForCheck();

    return hasErrors;
  }

  /**
   * Recursively validate MultiField/Composite/EntityReference sub-fields
   * Returns true if all sub-fields are valid, false if any have errors
   */
  private validateMultiFieldSubFields(field: FormField): boolean {
    let isValid = true;

    const subFields = this.getMultiFieldSubFields(field);
    subFields.forEach(subField => {
      const subFieldKristaField = this.kristaFields.get(subField.name);
      if (subFieldKristaField) {
        // Mark sub-field as touched so errors will be visible
        subFieldKristaField.markAsTouched();

        // Validate the sub-field
        if (!subFieldKristaField.validate()) {
          isValid = false;
        }
      }

      // Recursively validate nested MultiFields (e.g., MultiField inside EntityReference)
      if (this.isMultiField(subField)) {
        if (!this.validateMultiFieldSubFields(subField)) {
          isValid = false;
        }
      }
    });

    return isValid;
  }

  /**
   * Validate all cells in a Table field
   * Iterates through rows and columns, validating ALL cells (required or not)
   * This ensures email, phone, min/max, and other validations are checked
   * Returns { isValid, noRows } to differentiate between "no rows" and "cell errors"
   */
  private validateTableField(field: FormField): { isValid: boolean; noRows: boolean } {
    let isValid = true;

    const meta = field.attributeValues?.['meta'];
    if (!meta) return { isValid: true, noRows: false };

    const metaColumns = meta['columns'] || [];

    // Flatten columns to get leaf-level fields (same as table component does)
    const columns: FormField[] = [];
    for (const col of metaColumns) {
      const colField = col.field || col;

      if (colField.fieldType === 'com.krista.fields.MultiField' || colField.fieldType === 'com.krista.fields.Composite') {
        const subFields = colField.attributeValues?.['fields'] || [];
        for (const sf of subFields) {
          columns.push(sf);
        }
      } else {
        columns.push(colField);
      }
    }

    const rows = field.value?.['rows'] || [];

    // Helper function to check if a column is required
    // The required flag can be in different places depending on the field structure
    const isColumnRequired = (col: FormField): boolean => {
      // Check direct required property
      if (col.required === true) return true;
      // Check options.required.value (Krista backend format)
      if (col.options?.['required']?.['value'] === true) return true;
      return false;
    };

    // If any column is required but there are no rows, the table is invalid
    // User must add at least one row before submitting
    if (rows.length === 0) {
      const hasRequiredColumn = columns.some(col => isColumnRequired(col));
      if (hasRequiredColumn) {
        return { isValid: false, noRows: true };
      }
    }

    // Validate ALL cells (required or not) to catch email, phone, min/max errors
    for (const row of rows) {
      for (const column of columns) {
        const columnRequired = isColumnRequired(column);
        const cellValue = row[column.name];

        // For List/Table columns, validate that the array has actual content
        // An array with only null/empty items (e.g., [null]) should fail required validation
        if (columnRequired && this.isListOrTableFieldType(column.fieldType)) {
          if (!this.hasNonEmptyListRows(cellValue, column)) {
            isValid = false;
            continue;
          }
        }

        // Create a normalized field with required flag set correctly
        const cellField: FormField = {
          ...column,
          value: cellValue,
          required: columnRequired  // Use actual required status
        };

        // Validate the cell
        const result = this.kristaFieldService.validateField(cellField, cellValue);

        if (!result.isValid) {
          isValid = false;
        }
      }
    }

    return { isValid, noRows: false };
  }

  /**
   * Check if a field type is a List or Table field
   */
  private isListOrTableFieldType(fieldType?: string): boolean {
    return fieldType === 'com.krista.fields.List' || fieldType === 'com.krista.fields.Table';
  }

  /**
   * Check if a List/Table cell value has at least one non-empty row
   * Handles: null, undefined, [], [null], [{}], [{subField: null}]
   */
  private hasNonEmptyListRows(value: any, column: FormField): boolean {
    if (!value || !Array.isArray(value) || value.length === 0) {
      return false;
    }

    // Check if at least one row has actual content
    return value.some((row: any) => {
      if (row === null || row === undefined || row === '') {
        return false;
      }
      // For object rows (MultiField, EntityReference, Composite)
      if (typeof row === 'object' && !Array.isArray(row)) {
        // Check 'fields' property for EntityReference rows
        const obj = row.fields || row;
        return Object.values(obj).some(
          (v: any) => v !== null && v !== undefined && v !== ''
        );
      }
      // Primitive values (string, number) are non-empty if they reach here
      return true;
    });
  }

  /**
   * Filter out empty rows from a list value
   * Returns a new array with only non-empty rows
   */
  private filterEmptyListRows(rows: any[], columnField?: FormField): any[] {
    if (!rows || !Array.isArray(rows)) return rows;

    return rows.filter((row: any) => {
      if (row === null || row === undefined || row === '') {
        return false;
      }
      if (typeof row === 'object' && !Array.isArray(row)) {
        const obj = row.fields || row;
        return Object.values(obj).some(
          (v: any) => v !== null && v !== undefined && v !== ''
        );
      }
      return true;
    });
  }

  /**
   * Validate all cells in a List field
   * Handles three column types: simple fields, MultiField/Composite, and EntityReference
   * Returns true if all cells are valid, false if any have errors
   */
  private validateListField(field: FormField): boolean {
    let isValid = true;

    const columnField = field.attributeValues?.['field'] as FormField | undefined;
    if (!columnField) return true;

    const rows = Array.isArray(field.value) ? field.value : [];

    // Helper to check if a column is required
    const isColumnRequired = (col: FormField): boolean => {
      if (col.required === true) return true;
      if (col.options?.['required']?.['value'] === true) return true;
      return false;
    };

    if (columnField.fieldType === 'com.krista.fields.EntityReference') {
      // EntityReference: each row is { fields: { fieldName: value } }
      const entityFields = columnField.attributeValues?.['entityDefinition']?.['fields'];
      const fieldDefs: FormField[] = Array.isArray(entityFields) ? entityFields : (entityFields ? Object.values(entityFields) as FormField[] : []);

      for (const row of rows) {
        // Check if the entire row is empty — reject empty rows
        const rowValues = row?.fields || {};
        const isRowEmpty = Object.values(rowValues).every(
          (v: any) => v === null || v === undefined || v === ''
        );
        if (isRowEmpty) {
          isValid = false;
          continue;
        }

        for (const fieldDef of fieldDefs) {
          const cellValue = row?.fields?.[fieldDef.name];
          const cellField: FormField = {
            ...fieldDef,
            value: cellValue,
            required: isColumnRequired(fieldDef)
          };
          const result = this.kristaFieldService.validateField(cellField, cellValue);
          if (!result.isValid) {
            isValid = false;
          }
        }
      }
    } else if (columnField.fieldType === 'com.krista.fields.MultiField' || columnField.fieldType === 'com.krista.fields.Composite') {
      // MultiField/Composite: each row is { subFieldName: value }
      const subFields: FormField[] = columnField.attributeValues?.['fields'] || [];

      for (const row of rows) {
        // Check if the entire row is empty — reject empty rows
        if (row && typeof row === 'object') {
          const isRowEmpty = Object.values(row).every(
            (v: any) => v === null || v === undefined || v === ''
          );
          if (isRowEmpty) {
            isValid = false;
            continue;
          }
        }

        for (const subField of subFields) {
          const cellValue = row?.[subField.name];
          const cellField: FormField = {
            ...subField,
            value: cellValue,
            required: isColumnRequired(subField)
          };
          const result = this.kristaFieldService.validateField(cellField, cellValue);
          if (!result.isValid) {
            isValid = false;
          }
        }
      }
    } else {
      // Simple field: each row is the raw value
      for (const row of rows) {
        // Reject empty/null rows
        if (row === null || row === undefined || row === '') {
          isValid = false;
          continue;
        }

        const cellField: FormField = {
          ...columnField,
          value: row,
          required: isColumnRequired(columnField)
        };
        const result = this.kristaFieldService.validateField(cellField, row);
        if (!result.isValid) {
          isValid = false;
        }
      }
    }

    return isValid;
  }

  isFieldRequired(field: FormField): boolean {
    return field.required || false;
  }

  isFieldReadOnly(field: FormField): boolean {
    // Match original app logic: field is read-only if:
    // 1. Field itself is marked readOnly, OR
    // 2. Form is marked readOnly, OR
    // 3. Message type is not ASK (i.e., INFORM or ANSWERED messages have read-only forms), OR
    // 4. Form has been successfully submitted

    const fieldReadOnly = field.readOnly || false;
    const formReadOnly = this.message.form?.readOnly || false;
    const messageTypeReadOnly = this.message.messageType !== MessageType.Ask;
    const submittedReadOnly = this.isFormSubmittedSuccessfully;

    const isReadOnly = fieldReadOnly || formReadOnly || messageTypeReadOnly || submittedReadOnly;
    return isReadOnly;
  }

  hasFieldError(fieldName: string): boolean {
    // Only show errors after form submission attempt
    if (!this.hasAttemptedSubmit) return false;

    // Use KristaField for validation if available
    const kristaField = this.kristaFields.get(fieldName);
    if (kristaField) {
      return !kristaField.isValid;
    }

    // Fallback to old validation for fields not yet migrated
    const field = this.formFields.find(f => f.name === fieldName);
    return field ? this.getCachedFieldValidationError(field) !== null : false;
  }

  /**
   * Get validation error for a specific field
   * Uses KristaField as single source of truth
   */
  getCachedFieldValidationError(field: FormField): string | null {
    const kristaField = this.kristaFields.get(field.name);
    return kristaField ? kristaField.errorMessage : null;
  }

  /**
   * Check if field value is empty
   */
  private isFieldEmpty(field: FormField): boolean {
    if (field.value === null || field.value === undefined) return true;
    if (typeof field.value === 'string' && field.value.trim() === '') return true;
    if (Array.isArray(field.value) && field.value.length === 0) return true;
    return false;
  }

  getFieldType(field: FormField): string {
    return field.fieldType || 'text';
  }

  // Field type detection methods - delegating to FieldTypeService
  isTextField(field: FormField): boolean {
    return this.fieldTypeService.isTextField(field);
  }

  isAddressCompoundField(field: FormField): boolean {
    return this.fieldTypeService.isAddressCompoundField(field);
  }

  /**
   * Get address value from field (ensures it's an object)
   */
  getAddressValue(field: FormField): any {
    if (!field.value) {
      return {};
    }

    if (typeof field.value === 'string') {
      // If it's a string, set as street
      return { street: field.value };
    }

    if (typeof field.value === 'object') {
      return { ...field.value };
    }

    return {};
  }

  /**
   * Get display value for address sub-field (formatted for display)
   */
  getAddressSubFieldDisplayValue(field: FormField, subFieldName: string): string {
    const addressValue = this.getAddressValue(field);
    const value = addressValue[subFieldName];

    if (!value) {
      return '';
    }

    // Apply formatting based on sub-field type
    switch (subFieldName) {
      case 'street':
      case 'street2':
        return this.capitalizeAddress(value);
      case 'city':
        return this.capitalizeCity(value);
      case 'state':
        return this.capitalizeState(value);
      case 'country':
        return this.capitalizeCountry(value);
      case 'postalCode':
        return value.toString().trim().toUpperCase();
      default:
        return value.toString().trim();
    }
  }

  /**
   * Handle address sub-field blur event
   */
  onAddressSubFieldBlur(field: FormField, event: {fieldName: string, value: string}): void {
    const { fieldName, value } = event;

    if (!value || this.isFieldReadOnly(field)) {
      return;
    }

    // Apply field-specific formatting on blur
    let formattedValue = value.toString();

    switch (fieldName) {
      case 'street':
      case 'street2':
        formattedValue = this.capitalizeAddress(value);
        break;
      case 'city':
        formattedValue = this.capitalizeCity(value);
        break;
      case 'state':
        formattedValue = this.capitalizeState(value);
        break;
      case 'country':
        formattedValue = this.capitalizeCountry(value);
        break;
      case 'postalCode':
        formattedValue = value.toString().trim().toUpperCase();
        break;
      default:
        formattedValue = formattedValue.trim();
    }

    // Update the field value if formatting changed it
    if (formattedValue !== value) {
      const addressValue = this.getAddressValue(field);
      const updatedAddress = {
        ...addressValue,
        [fieldName]: formattedValue
      };
      this.onFieldValueChange(field.name, updatedAddress);
    }
  }

  /**
   * Capitalize address (street) - handles common abbreviations
   */
  private capitalizeAddress(value: string): string {
    if (!value || !value.trim()) return value;
    return value.replace(/\b\w+/g, (word) => {
      const upperCaseWords = ['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW', 'ST', 'AVE', 'BLVD', 'RD', 'DR', 'LN', 'CT', 'PL'];
      return upperCaseWords.includes(word.toUpperCase())
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
  }

  /**
   * Capitalize proper noun (city, state, country)
   */
  private capitalizeProperNoun(value: string): string {
    if (!value || !value.trim()) return value;
    return value.replace(/\b\w+/g, (word) =>
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    );
  }

  // Convenience aliases for address sub-fields
  private capitalizeCity = this.capitalizeProperNoun.bind(this);
  private capitalizeState = this.capitalizeProperNoun.bind(this);
  private capitalizeCountry = this.capitalizeProperNoun.bind(this);

  // ============================================================================
  // Pick-One Field Business Logic
  // ============================================================================

  // ============================================================================
  // Dynamic Field Event Handlers
  // ============================================================================

  /**
   * Handle value change from DynamicFieldComponent
   * Routes to the appropriate handler based on field type
   */
  onDynamicFieldValueChange(field: FormField, value: any): void {
    // For all field types, use the common value change handler
    this.onFieldValueChange(field.name, value);
  }

  /**
   * Handle blur event from DynamicFieldComponent
   * Routes to the appropriate handler based on field type
   */
  onDynamicFieldBlur(field: FormField, value: any): void {
    // Route to specific blur handlers based on field type
    if (this.usesTextFieldComponent(field)) {
      this.onTextFieldBlur(field, value);
    } else if (this.isNumberField(field)) {
      this.onNumberFieldBlur(field, value);
    }
    // Other field types don't have special blur handling
  }

  /**
   * Handle focus event from DynamicFieldComponent
   * Routes to the appropriate handler based on field type
   */
  onDynamicFieldFocus(field: FormField): void {
    // Route to specific focus handlers based on field type
    if (this.isNumberField(field)) {
      this.onNumberFieldFocus(field);
    }
    // Other field types don't have special focus handling
  }

  /**
   * Handle sub-field blur event from DynamicFieldComponent
   * Routes to the appropriate handler based on parent field type
   */
  onDynamicFieldSubFieldBlur(field: FormField, event: {fieldName: string, value: any}): void {
    // Route to specific handlers based on parent field type
    if (this.isAddressCompoundField(field)) {
      this.onAddressSubFieldBlur(field, event);
    } else if (this.isMultiField(field)) {
      this.onMultiFieldSubFieldBlur(event.fieldName, event.value);
    }
  }

  /**
   * Handle sub-field value change event from DynamicFieldComponent
   * Routes to the appropriate handler based on parent field type
   */
  onDynamicFieldSubFieldValueChange(field: FormField, event: {fieldName: string, value: any}): void {
    // Route to MultiField handler
    if (this.isMultiField(field)) {
      this.onMultiFieldSubFieldChange(field, event.fieldName, event.value);
    }
  }

  // ============================================================================
  // Location Field Business Logic
  // ============================================================================

  /**
   * Get display value for location field
   * Matches original app's Location.toString() logic
   */
  getLocationDisplayValue(field: FormField): string {
    if (!field.value) {
      return '';
    }

    // If value is a Location object
    if (typeof field.value === 'object' && field.value.latitude !== undefined) {
      const loc = field.value;

      // If address is available, use it
      if (loc.address) {
        return loc.address;
      }

      // Otherwise, build from components
      if (loc.city || loc.country) {
        const parts = [loc.area, loc.city, loc.state, loc.zip, loc.country].filter((p: any) => p);
        return parts.join(', ');
      }

      // Fallback to coordinates
      return `${loc.latitude}, ${loc.longitude}`;
    }

    // If value is a string, return as-is
    return String(field.value);
  }

  /**
   * Check if map selection is allowed for location field
   */
  isLocationMapSelectionAllowed(field: FormField): boolean {
    return field.attributeValues?.['allowMapSelection'] || false;
  }

  // ============================================================================
  // File Field Business Logic
  // ============================================================================

  /**
   * Get workspace ID for file download and upload
   */
  getWorkspaceId(): string {
    return this.formFacade.getWorkspaceId() || 'default';
  }

  /**
   * Get client session ID for file download and entity search
   */
  getClientSessionId(): string {
    return this.formFacade.getClientSessionId();
  }



  isNumberField(field: FormField): boolean {
    return this.fieldTypeService.isNumberField(field);
  }

  isPhoneField(field: FormField): boolean {
    return this.fieldTypeService.isPhoneField(field);
  }

  /**
   * Check if field should use text-field component
   * Now excludes number fields (they use number-field component)
   */
  usesTextFieldComponent(field: FormField): boolean {
    return this.fieldTypeService.usesTextFieldComponent(field);
  }

  isAddressField(field: FormField): boolean {
    return this.fieldTypeService.isAddressField(field);
  }

  isTextBasedField(field: FormField): boolean {
    return this.fieldTypeService.isTextBasedField(field);
  }

  isCalculationField(field: FormField): boolean {
    return this.fieldTypeService.isCalculationField(field);
  }

  isContentStreamField(field: FormField): boolean {
    return this.fieldTypeService.isContentStreamField(field);
  }

  isCameraField(field: FormField): boolean {
    return this.fieldTypeService.isCameraField(field);
  }

  isDateField(field: FormField): boolean {
    return this.fieldTypeService.isDateField(field);
  }

  isDateRangeField(field: FormField): boolean {
    return this.fieldTypeService.isDateRangeField(field);
  }

  isDateTimeRangeField(field: FormField): boolean {
    return this.fieldTypeService.isDateTimeRangeField(field);
  }

  isTimeField(field: FormField): boolean {
    return this.fieldTypeService.isTimeField(field);
  }

  isLocationField(field: FormField): boolean {
    return this.fieldTypeService.isLocationField(field);
  }

  isSwitchField(field: FormField): boolean {
    return this.fieldTypeService.isSwitchField(field);
  }

  isRatingField(field: FormField): boolean {
    return this.fieldTypeService.isRatingField(field);
  }

  isPickOneField(field: FormField): boolean {
    return this.fieldTypeService.isPickOneField(field);
  }

  isCheckboxesField(field: FormField): boolean {
    return this.fieldTypeService.isCheckboxesField(field);
  }

  isFileField(field: FormField): boolean {
    return this.fieldTypeService.isFileField(field);
  }

  isRichTextField(field: FormField): boolean {
    return this.fieldTypeService.isRichTextField(field);
  }

  isEntitySelectionField(field: FormField): boolean {
    return this.fieldTypeService.isEntitySelectionField(field);
  }

  isLabelField(field: FormField): boolean {
    return this.fieldTypeService.isLabelField(field);
  }

  isMultiField(field: FormField): boolean {
    return this.fieldTypeService.isMultiField(field);
  }

  /**
   * Get the content to display for a Label field
   * Label fields store their content in attributeValues.text.message
   * Falls back to field.value or field.name if text.message is not available
   */
  getLabelFieldContent(field: FormField): string {
    // Try to get content from attributeValues.text.message (primary source)
    const textMessage = field.attributeValues?.['text']?.['message'];
    if (textMessage) {
      return textMessage;
    }

    // Fallback to field.value
    if (field.value) {
      return field.value;
    }

    // Final fallback to field.name
    return field.name || '';
  }

  // Additional field handling methods
  onCheckboxChange(fieldName: string, optionValue: any, checked: boolean): void {
    const field = this.formFields.find(f => f.name === fieldName);
    if (!field) return;

    let currentValues = field.value || [];
    if (!Array.isArray(currentValues)) {
      currentValues = [];
    }

    if (checked) {
      if (!currentValues.includes(optionValue)) {
        currentValues.push(optionValue);
      }
    } else {
      currentValues = currentValues.filter((v: any) => v !== optionValue);
    }

    this.onFieldValueChange(fieldName, currentValues);
  }

  /**
   * Handle mat-slide-toggle change events
   */
  onSwitchChange(fieldName: string, event: any): void {
    const checked = event.checked;
    this.onFieldValueChange(fieldName, checked);
  }

  /**
   * Handle radio button change events
   */
  onRadioChange(fieldName: string, value: any): void {
    const field = this.formFields.find(f => f.name === fieldName);
    if (field && !this.isFieldReadOnly(field)) {
      this.onFieldValueChange(fieldName, value);
    }
  }

  /**
   * Handle custom toggle click events
   */
  onToggleClick(fieldName: string): void {
    const field = this.formFields.find(f => f.name === fieldName);
    if (!field || this.isFieldReadOnly(field)) {
      return;
    }

    const newValue = !field.value;
    this.onFieldValueChange(fieldName, newValue);
  }

  /**
   * Handle key press events from field components
   */
  onFieldKeyPress(field: FormField, event: KeyboardEvent): void {
    // Handle Enter key submission (only for single-field forms)
    if (event.key === 'Enter' && !event.shiftKey) {
      if (this.canSubmitOnEnter()) {
        event.preventDefault();
        this.onSubmitForm();
        return;
      }
    }

    // Handle keypress validation for number-based fields
    // Note: Email, Phone, and Percentage filtering is now handled by KristaField formatters
    if (this.isNumberBasedField(field)) {
      this.onNumberKeyPress(event);
    }
  }

  /**
   * Check if form can be submitted on Enter key press
   * Only allow Enter submission for single-field forms (matching original behavior)
   */
  private canSubmitOnEnter(): boolean {
    if (!this.showSendButton) {
      return false;
    }
    // Only submit on Enter if there's exactly one field
    return this.formFields.length === 1;
  }

  /**
   * Check if field is a number-based field (Number, Currency, Unit)
   */
  private isNumberBasedField(field: FormField): boolean {
    return this.fieldTypeService.isNumberBasedField(field);
  }

  /**
   * Handle keypress for number-based fields - only allow numbers, decimal point, and minus sign
   */
  private onNumberKeyPress(event: KeyboardEvent): void {
    const char = event.key;
    const inputElement = event.target as HTMLInputElement;
    const currentValue = inputElement.value;

    // Allow control keys
    if (event.ctrlKey || event.metaKey ||
        ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(char)) {
      return;
    }

    // Allow numbers, decimal point (only one), and minus sign (only at start)
    if (/[0-9]/.test(char) ||
        (char === '.' && !currentValue.includes('.')) ||
        (char === '-' && currentValue.length === 0)) {
      return;
    }

    // Block all other characters
    event.preventDefault();
  }

  /**
   * Get field width class based on visualWidth attribute
   * Follows kristaclient pattern: s -> small, m -> medium, l -> large
   */
  getFieldWidthClass(field: FormField): string {
    const visualWidth = field.attributeValues?.['visualWidth'];

    // Check if field is a composite/complex field type that should always be large
    const alwaysLargeTypes = [
      'com.krista.fields.Address',
      'com.krista.fields.MultiField',
      'com.krista.fields.Entity',
      'com.krista.fields.Composite',
      'com.krista.fields.Label',
      'com.krista.fields.RichText',
      'com.krista.fields.List',
      'com.krista.fields.Table'
    ];

    if (alwaysLargeTypes.includes(field.fieldType)) {
      return 'large';
    }

    // Convert backend values (S/M/L) to CSS classes
    if (!visualWidth) {
      return 'small'; // Default to small if not specified
    }

    const width = visualWidth.toString().toLowerCase();
    switch (width) {
      case 's':
        return 'small';
      case 'm':
        return 'medium';
      case 'l':
        return 'large';
      default:
        return 'small';
    }
  }

  /**
   * Get display value for text field (formatted for display)
   */
  getTextFieldDisplayValue(field: FormField): string {
    if (field.value === null || field.value === undefined) {
      return '';
    }

    // Use toolkit's getFormattedValue for supported field types
    const toolkitFormattedTypes = [
      'com.krista.fields.Phone',
      'com.krista.fields.Percentage',
      'com.krista.fields.Number',
      'com.krista.fields.Currency',
      'com.krista.fields.Email'
    ];

    if (toolkitFormattedTypes.includes(field.fieldType)) {
      try {
        const formattedValue = this.kristaFieldService.getFormattedValue(field, field.value);
        return formattedValue || '';
      } catch (error) {
        // Fall through to default handling
      }
    }

    // Handle object values (e.g., from API)
    if (typeof field.value === 'object') {
      if (field.value.value !== undefined) {
        return field.value.value.toString();
      }
      if (field.value.text !== undefined) {
        return field.value.text.toString();
      }
      if (field.value.displayValue !== undefined) {
        return field.value.displayValue.toString();
      }
      return '';
    }

    return field.value.toString();
  }

  /**
   * Get HTML input type for text field
   */
  getTextFieldInputType(field: FormField): string {
    if (field.fieldType === 'com.krista.fields.Email') {
      return 'email';
    } else if (field.fieldType === 'com.krista.fields.Phone') {
      return 'tel';
    } else if (field.fieldType === 'com.krista.fields.Number' ||
               field.fieldType === 'com.krista.fields.Currency' ||
               field.fieldType === 'com.krista.fields.Percentage') {
      return 'text'; // Use text for better control over validation
    }
    return 'text';
  }

  /**
   * Get config object for text field
   * Uses KristaField as single source of truth
   */
  getTextFieldConfig(field: FormField): TextFieldConfig {
    const kristaField = this.kristaFields.get(field.name);

    // All fields should have KristaField instances now
    if (!kristaField) {
      console.warn(`KristaField not found for field: ${field.name}`);
    }

    // Only show errors if field has been touched (UX best practice)
    const shouldShowError = kristaField ? (!kristaField.isValid && kristaField.isTouched) : false;

    return {
      displayValue: kristaField?.formattedValue || '',
      inputType: this.getTextFieldInputType(field),
      hasError: shouldShowError,
      errorMessage: shouldShowError ? (kristaField?.errorMessage || '') : '',
      readOnly: this.isFieldReadOnly(field),
      rows: 4,
      hideRequiredIndicator: this.message.messageType === MessageType.Inform
    };
  }

  /**
   * Get config object for number fields (Number, Currency, Unit, Percentage)
   * Uses KristaField as single source of truth
   */
  getNumberFieldConfig(field: FormField): TextFieldConfig {
    const kristaField = this.kristaFields.get(field.name);

    // All fields should have KristaField instances now
    if (!kristaField) {
      console.warn(`KristaField not found for field: ${field.name}`);
    }

    // Only show errors if field has been touched (UX best practice)
    const shouldShowError = kristaField ? (!kristaField.isValid && kristaField.isTouched) : false;

    // For percentage fields, display value with % symbol ONLY when not focused
    // When focused, show raw numeric value for easier editing
    let displayValue = kristaField?.formattedValue || '';
    const isFocused = this.focusedFields.has(field.name);
    const isReadOnly = this.isFieldReadOnly(field);

    if (field.fieldType === 'com.krista.fields.Percentage' && field.value !== undefined && field.value !== null && field.value !== '') {
      if (isFocused) {
        // While typing, show raw numeric value without %
        displayValue = `${field.value}`;
      } else if (isReadOnly) {
        // For readonly fields, value might be in decimal format (0.23) from API
        // Convert to percentage display (23%)
        const numValue = parseFloat(field.value.toString());
        if (!isNaN(numValue) && Math.abs(numValue) < 1 && numValue !== 0) {
          // Convert decimal to percentage (0.23 -> 23%)
          displayValue = `${(numValue * 100).toFixed(0)}%`;
        } else {
          displayValue = `${field.value}%`;
        }
      } else {
        // When not focused, show with % symbol
        displayValue = `${field.value}%`;
      }
    }

    const config = {
      displayValue: displayValue,
      inputType: 'text', // Always use 'text' for better numeric formatting control
      hasError: shouldShowError,
      errorMessage: shouldShowError ? (kristaField?.errorMessage || '') : '',
      readOnly: isReadOnly,
      rows: 1, // Numbers are always single-line
      hideRequiredIndicator: this.message.messageType === MessageType.Inform
    };

    return config;
  }

  /**
   * Get config object for rich text field (WYSIWYG editor)
   * Uses KristaField as single source of truth
   */
  getRichTextFieldConfig(field: FormField): RichTextFieldConfig {
    const kristaField = this.kristaFields.get(field.name);

    // All fields should have KristaField instances now
    if (!kristaField) {
      console.warn(`KristaField not found for field: ${field.name}`);
    }

    // Only show errors if field has been touched (UX best practice)
    const shouldShowError = kristaField ? (!kristaField.isValid && kristaField.isTouched) : false;

    // Get maxLineCount from field attributes (default to 2 if not specified)
    const maxLineCount = field.attributeValues?.['maxLineCount'] || 2;

    return {
      displayValue: kristaField?.formattedValue || '',
      hasError: shouldShowError,
      errorMessage: shouldShowError ? (kristaField?.errorMessage || '') : '',
      readOnly: this.isFieldReadOnly(field),
      maxLineCount: maxLineCount,
      hideRequiredIndicator: this.message.messageType === MessageType.Inform
    };
  }

  /**
   * Get config object for basic fields (date, time, switch, rating, pick-one, pick-many, etc.)
   * Uses KristaField as single source of truth
   */
  getBasicFieldConfig(field: FormField): BasicFieldConfig {
    const kristaField = this.kristaFields.get(field.name);

    // All fields should have KristaField instances now
    if (!kristaField) {
      console.warn(`KristaField not found for field: ${field.name}`);
    }

    // Only show errors after form submission attempt (UX best practice)
    // This prevents showing "Please select both dates" error while user is still filling the form
    const shouldShowError = this.hasAttemptedSubmit && kristaField ? !kristaField.isValid : false;

    return {
      hasError: shouldShowError,
      errorMessage: shouldShowError ? (kristaField?.errorMessage || '') : '',
      readOnly: this.isFieldReadOnly(field),
      hideRequiredIndicator: this.message.messageType === MessageType.Inform
    };
  }

  /**
   * Get config object for address field
   * Uses KristaField as single source of truth
   */
  getAddressFieldConfig(field: FormField): AddressFieldConfig {
    const kristaField = this.kristaFields.get(field.name);

    // All fields should have KristaField instances now
    if (!kristaField) {
      console.warn(`KristaField not found for field: ${field.name}`);
    }

    // Only show errors after form submission attempt (UX best practice)
    const shouldShowError = this.hasAttemptedSubmit && kristaField ? !kristaField.isValid : false;

    return {
      streetDisplayValue: this.getAddressSubFieldDisplayValue(field, 'street'),
      street2DisplayValue: this.getAddressSubFieldDisplayValue(field, 'street2'),
      cityDisplayValue: this.getAddressSubFieldDisplayValue(field, 'city'),
      stateDisplayValue: this.getAddressSubFieldDisplayValue(field, 'state'),
      countryDisplayValue: this.getAddressSubFieldDisplayValue(field, 'country'),
      postalCodeDisplayValue: this.getAddressSubFieldDisplayValue(field, 'postalCode'),
      hasError: shouldShowError,
      errorMessage: shouldShowError ? (kristaField?.errorMessage || '') : '',
      readOnly: this.isFieldReadOnly(field),
      hideRequiredIndicator: this.message.messageType === MessageType.Inform
    };
  }

  /**
   * Get config object for location field
   * Uses KristaField as single source of truth
   */
  getLocationFieldConfig(field: FormField): LocationFieldConfig {
    const kristaField = this.kristaFields.get(field.name);

    // All fields should have KristaField instances now
    if (!kristaField) {
      console.warn(`KristaField not found for field: ${field.name}`);
    }

    // Only show errors after form submission attempt (UX best practice)
    const shouldShowError = this.hasAttemptedSubmit && kristaField ? !kristaField.isValid : false;

    return {
      displayValue: this.getLocationDisplayValue(field),
      allowMapSelection: this.isLocationMapSelectionAllowed(field),
      hasError: shouldShowError,
      errorMessage: shouldShowError ? (kristaField?.errorMessage || '') : '',
      readOnly: this.isFieldReadOnly(field),
      hideRequiredIndicator: this.message.messageType === MessageType.Inform
    };
  }

  /**
   * Get config object for file field
   * Uses KristaField as single source of truth
   */
  getFileFieldConfig(field: FormField): FileFieldConfig {
    const kristaField = this.kristaFields.get(field.name);

    // All fields should have KristaField instances now
    if (!kristaField) {
      console.warn(`KristaField not found for field: ${field.name}`);
    }

    // Only show errors after form submission attempt (UX best practice)
    const shouldShowError = this.hasAttemptedSubmit && kristaField ? !kristaField.isValid : false;

    return {
      workspaceId: this.getWorkspaceId(),
      clientSessionId: this.getClientSessionId(),
      hasError: shouldShowError,
      errorMessage: shouldShowError ? (kristaField?.errorMessage || '') : '',
      readOnly: this.isFieldReadOnly(field),
      hideRequiredIndicator: this.message.messageType === MessageType.Inform
    };
  }

  /**
   * Get configuration for MultiField/Composite fields
   */
  getMultiFieldConfig(field: FormField): BasicFieldConfig {
    const kristaField = this.kristaFields.get(field.name);
    const isValid = kristaField ? kristaField.isValid : true;
    const shouldShowError = this.hasAttemptedSubmit && !isValid;

    return {
      hasError: shouldShowError,
      errorMessage: shouldShowError ? (kristaField?.errorMessage || '') : '',
      readOnly: this.isFieldReadOnly(field),
      hideRequiredIndicator: this.message.messageType === MessageType.Inform
    };
  }

  /**
   * Transform EntityReference field value for submission
   * Adds meta object with entity type information and transforms nested field values
   */
  private transformEntityReferenceValue(field: FormField, value: any): any {
    if (!value || !value.fields) {
      return value;
    }

    const entityDefinition = field.attributeValues?.['entityDefinition'];
    if (!entityDefinition) {
      return value;
    }

    // Build meta object from entityDefinition (matching original EntityMeta.toJSON())
    const meta: any = {};

    // Preserve primaryKey from existing value's meta if present
    if (value.meta?.primaryKey) {
      meta.primaryKey = value.meta.primaryKey;
    }

    if (entityDefinition.entityType) {
      meta.entityType = {
        entityId: entityDefinition.entityType.entityId,
        entityName: entityDefinition.entityType.entityName,
        registry: {
          domainId: entityDefinition.entityType.registry?.domainId,
          ecosystemId: entityDefinition.entityType.registry?.ecosystemId,
          catalogId: entityDefinition.entityType.registry?.catalogId,
          invokerId: entityDefinition.entityType.registry?.invokerId
        }
      };
    }

    // Transform nested field values
    // Iterate over ALL fields in entity definition (not just fields with values)
    // This ensures empty/null fields are included in the payload (matching original behavior)
    const transformedFields: any = {};
    const entityFieldsObj = entityDefinition.fields || {};

    Object.keys(entityFieldsObj).forEach((fieldName: string) => {
      const fieldDef = entityFieldsObj[fieldName];
      const fieldValue = value.fields?.[fieldName];

      // Create a temporary FormField for transformation
      const tempField: FormField = {
        fieldId: `${field.name}.${fieldName}`,
        name: `${field.name}.${fieldName}`,
        fieldType: fieldDef.fieldType,
        value: fieldValue,
        attributeValues: fieldDef.attributeValues || {},
        options: fieldDef.options || {}
      };

      // Transform the value using KristaFieldService
      let transformedValue = this.kristaFieldService.getKristaValue(tempField, fieldValue);

      // Special handling for Percentage fields: convert from display value (e.g., 12) to decimal (e.g., 0.12)
      if (fieldDef.fieldType === 'com.krista.fields.Percentage' && transformedValue !== null && transformedValue !== undefined) {
        transformedValue = Number(transformedValue) / 100;
      }

      // Remove 'extension' field from File field metadata (original code doesn't include it)
      if (fieldDef.fieldType === 'com.krista.fields.File' && Array.isArray(transformedValue)) {
        transformedValue = transformedValue.map((fileMetadata: any) => {
          const { extension, ...rest } = fileMetadata;
          return rest;
        });
      }

      // Special handling for Label fields: convert null/undefined to empty string
      if (fieldDef.fieldType === 'com.krista.fields.Label' && (transformedValue === null || transformedValue === undefined)) {
        transformedValue = '';
      }

      transformedFields[fieldName] = transformedValue;
    });

    return {
      meta,
      fields: transformedFields
    };
  }

  /**
   * Get sub-fields for EntityReference fields
   * EntityReference fields have their sub-fields in attributeValues.entityDefinition.fields as an object
   */
  getEntityReferenceSubFields(field: FormField): FormField[] {
    const entityDefinition = field.attributeValues?.['entityDefinition'];

    if (!entityDefinition || !entityDefinition.fields) {
      console.warn('[FormMessage] EntityReference field has no entityDefinition.fields:', field.name);
      return [];
    }

    // Entity fields are stored as an object (key-value pairs), not an array
    const entityFieldsObj = entityDefinition.fields;

    // Get the current entity value
    const entityValue = field.value || {};
    const entityFieldValues = entityValue.fields || {};

    // Convert object to array of FormField objects
    const subFields: FormField[] = Object.keys(entityFieldsObj).map((fieldName: string) => {
      const fieldJson = entityFieldsObj[fieldName];
      const subFieldValue = entityFieldValues[fieldName];

      // Create full field name for KristaField lookup (e.g., "Entity1.Text1")
      const subFieldFullName = `${field.name}.${fieldName}`;

      // Extract required flag from options
      const isRequired = fieldJson.options?.required?.value || false;

      // Handle nested MultiField/Composite fields
      // In entity definitions, MultiField sub-fields are stored in fieldJson.fields as an object
      // We need to convert them to attributeValues.fields as an array for the MultiField component
      let attributeValues = fieldJson.attributeValues || {};

      if (fieldJson.fields && typeof fieldJson.fields === 'object') {
        // This is a MultiField/Composite with nested fields stored as object
        // Convert to array format expected by MultiField component
        const nestedFieldsArray = Object.keys(fieldJson.fields).map((nestedFieldName: string) => {
          const nestedFieldJson = fieldJson.fields[nestedFieldName];

          // Create KristaField for nested MultiField sub-fields (e.g., "Entity1.Multi field1.Number1")
          const nestedFieldFullName = `${subFieldFullName}.${nestedFieldName}`;
          const nestedFieldIsRequired = nestedFieldJson.options?.required?.value || false;

          // Get the nested field value from the entity value
          const multiFieldValue = subFieldValue || {};
          const nestedFieldValue = multiFieldValue[nestedFieldName];

          // Create KristaField instance for nested sub-field if it doesn't exist
          if (!this.kristaFields.has(nestedFieldFullName)) {
            const nestedFieldDef = {
              name: nestedFieldFullName,
              fieldType: nestedFieldJson.fieldType,
              value: nestedFieldValue,
              required: nestedFieldIsRequired,
              readOnly: field.readOnly || nestedFieldJson.readOnly || false,
              attributeValues: nestedFieldJson.attributeValues || {},
              options: nestedFieldJson.options || {}
            } as FormField;

            const nestedKristaField = this.kristaFieldFactory.create(nestedFieldDef);
            this.kristaFields.set(nestedFieldFullName, nestedKristaField);
          }

          return {
            name: nestedFieldName,
            fieldType: nestedFieldJson.fieldType,
            attributeValues: nestedFieldJson.attributeValues || {},
            options: nestedFieldJson.options || {},
            required: nestedFieldIsRequired,
            readOnly: nestedFieldJson.readOnly || false
          };
        });

        // Add the converted fields array to attributeValues
        attributeValues = {
          ...attributeValues,
          fields: nestedFieldsArray
        };
      }

      // Create KristaField instance for this sub-field if it doesn't exist
      // This is needed for validation to work properly
      if (!this.kristaFields.has(subFieldFullName)) {
        const subFieldDef = {
          name: subFieldFullName,
          fieldType: fieldJson.fieldType,
          value: subFieldValue,
          required: isRequired,
          readOnly: field.readOnly || fieldJson.readOnly || false,
          attributeValues: attributeValues,
          options: fieldJson.options || {}
        } as FormField;

        const kristaField = this.kristaFieldFactory.create(subFieldDef);
        this.kristaFields.set(subFieldFullName, kristaField);
      }

      // Create FormField object
      const subField: FormField = {
        fieldId: subFieldFullName,
        name: subFieldFullName,
        displayName: fieldName, // Use short name for display
        fieldType: fieldJson.fieldType,
        value: subFieldValue,
        required: isRequired,
        readOnly: field.readOnly || false,
        attributeValues: attributeValues,
        options: fieldJson.options || {}
      };

      return subField;
    });

    return subFields;
  }

  /**
   * Get sub-fields for MultiField/Composite/EntityReference fields
   */
  getMultiFieldSubFields(field: FormField): FormField[] {
    // Handle EntityReference fields differently
    if (field.fieldType === FieldTypes.ENTITY_FIELD) {
      return this.getEntityReferenceSubFields(field);
    }

    // Sub-fields are stored in attributeValues.fields for MultiField/Composite
    const subFieldsJson = field.attributeValues?.['fields'];

    if (!subFieldsJson || !Array.isArray(subFieldsJson)) {
      return [];
    }

    // Convert JSON to FormField objects
    const subFields: FormField[] = subFieldsJson.map((subFieldJson: any) => {
      // Get the current value for this sub-field from the parent field's value
      const parentValue = field.value || {};
      let subFieldValue = parentValue[subFieldJson.name];

      // Initialize Label fields with empty string if no value exists
      // This ensures Label fields are included in the payload
      if (subFieldJson.fieldType === 'com.krista.fields.Label' && subFieldValue === undefined) {
        subFieldValue = '';
        // Update parent value to include the Label field
        if (!parentValue[subFieldJson.name]) {
          parentValue[subFieldJson.name] = '';
          field.value = parentValue;
        }
      }

      // Create a unique name for the sub-field by combining parent and sub-field names
      const subFieldFullName = `${field.name}.${subFieldJson.name}`;

      // Extract required flag - it can be in different locations:
      // 1. subFieldJson.required (direct boolean)
      // 2. subFieldJson.options.required.value (nested in options)
      let isRequired = false;
      if (typeof subFieldJson.required === 'boolean') {
        isRequired = subFieldJson.required;
      } else if (subFieldJson.options?.required?.value === true) {
        isRequired = true;
      }

      // Create KristaField instance for this sub-field if it doesn't exist
      if (!this.kristaFields.has(subFieldFullName)) {
        const subFieldDef = {
          name: subFieldFullName,
          fieldType: subFieldJson.fieldType,
          value: subFieldValue,
          required: isRequired,
          readOnly: field.readOnly || subFieldJson.readOnly || false,
          attributeValues: subFieldJson.attributeValues || {},
          options: subFieldJson.options || {}
        } as FormField;

        const kristaField = this.kristaFieldFactory.create(subFieldDef);
        this.kristaFields.set(subFieldFullName, kristaField);
      }

      return {
        fieldId: subFieldFullName,  // Use full name as fieldId for toolkit compatibility
        name: subFieldFullName,  // Use full name for KristaField lookup
        displayName: subFieldJson.name,  // Use short name for display (e.g., "Phone1" instead of "Multi field1.Phone1")
        fieldType: subFieldJson.fieldType,
        value: subFieldValue,
        required: isRequired,
        readOnly: field.readOnly || subFieldJson.readOnly || false,
        attributeValues: subFieldJson.attributeValues || {},
        options: subFieldJson.options || {}
      } as FormField;
    });

    return subFields;
  }

  /**
   * Handle sub-field value change for MultiField and EntityReference
   */
  onMultiFieldSubFieldChange(parentField: FormField, subFieldFullName: string, value: any): void {
    // Extract the actual sub-field name (remove parent prefix)
    const subFieldName = subFieldFullName.split('.').pop() || subFieldFullName;

    // Get current parent value (object with sub-field values)
    const parentValue = parentField.value || {};

    // Handle null/undefined/empty string for number fields - convert to null
    // This ensures consistency with original app behavior
    let processedValue = value;
    if (value === '' || value === undefined) {
      processedValue = null;
    }

    // For phone fields, convert string to phone object immediately (like original code does)
    // This matches original's PhoneFieldRenderer behavior where convertToJson is called on change
    // Get the sub-field from the parent field's sub-fields (not from this.formFields!)
    const subFields = this.getMultiFieldSubFields(parentField);
    const subField = subFields.find(f => f.name === subFieldFullName);

    if (subField && subField.fieldType === 'com.krista.fields.Phone' && processedValue) {
      // Use kristaFieldService to convert phone string to phone object
      processedValue = this.kristaFieldService.getKristaValue(subField, processedValue);
    }

    // Check if this is a deeply nested field (e.g., "Entity1.Multi field1.Number1" or "Multi1.NestedMulti.Text1")
    // If so, we need to update intermediate MultiField values
    const fieldParts = subFieldFullName.split('.');
    if (fieldParts.length > 2) {
      // This is a nested field inside a MultiField
      // Example: "Multi1.NestedMulti.Text1" -> ["Multi1", "NestedMulti", "Text1"]
      const immediateParentName = fieldParts.slice(0, -1).join('.'); // "Multi1.NestedMulti"
      const immediateParentField = subFields.find(f => f.name === immediateParentName);

      if (immediateParentField && this.isMultiField(immediateParentField)) {
        // Update the immediate parent MultiField's value
        const immediateParentValue = immediateParentField.value || {};
        const updatedImmediateParentValue = {
          ...immediateParentValue,
          [subFieldName]: processedValue
        };

        // Update immediate parent field value
        immediateParentField.value = updatedImmediateParentValue;

        // Update immediate parent KristaField and validate
        const immediateParentKristaField = this.kristaFields.get(immediateParentName);
        if (immediateParentKristaField) {
          immediateParentKristaField.setValue(updatedImmediateParentValue);
          immediateParentKristaField.validate();
        }

        // Ensure KristaFields exist for nested sub-fields by calling getMultiFieldSubFields
        // This is needed because multi-field.component.ts getSubFieldsForNestedField() doesn't create KristaFields
        this.getMultiFieldSubFields(immediateParentField);

        // Update the top-level parent with the updated nested MultiField value
        const nestedFieldShortName = fieldParts[1];
        if (parentField.fieldType === FieldTypes.ENTITY_FIELD) {
          parentField.value = {
            ...parentValue,
            fields: {
              ...(parentValue.fields || {}),
              [nestedFieldShortName]: updatedImmediateParentValue
            }
          };
        } else {
          // Regular MultiField/Composite parent
          parentField.value = {
            ...parentValue,
            [nestedFieldShortName]: updatedImmediateParentValue
          };
        }
      }
    } else {
      // Direct sub-field of parent (not nested)
      // Update the sub-field value in parent object
      // EntityReference fields store sub-field values in a nested 'fields' object
      // MultiField/Composite fields store sub-field values at the root level
      let updatedValue;
      if (parentField.fieldType === FieldTypes.ENTITY_FIELD) {
        // EntityReference: { fields: { "SubField1": value1, "SubField2": value2 } }
        updatedValue = {
          ...parentValue,
          fields: {
            ...(parentValue.fields || {}),
            [subFieldName]: processedValue
          }
        };
      } else {
        // MultiField/Composite: { "SubField1": value1, "SubField2": value2 }
        updatedValue = {
          ...parentValue,
          [subFieldName]: processedValue
        };
      }

      // Update parent field value
      parentField.value = updatedValue;
    }

    // Update parent KristaField and validate to clear parent errors
    const parentKristaField = this.kristaFields.get(parentField.name);
    if (parentKristaField) {
      parentKristaField.setValue(parentField.value);
      // Validate parent field to clear "required" errors when sub-fields are filled
      parentKristaField.validate();
    }

    // Update sub-field KristaField and validate to clear errors
    const subFieldKristaField = this.kristaFields.get(subFieldFullName);
    if (subFieldKristaField) {
      subFieldKristaField.setValue(processedValue);
      // Validate to clear "required" errors when value is provided
      subFieldKristaField.validate();
    }

    // Mark for check to trigger change detection
    this.cdr.markForCheck();
  }

  /**
   * Handle sub-field blur event for MultiField
   * Applies formatting (e.g., capitalization for Person/ProperNoun fields, phone object conversion)
   */
  onMultiFieldSubFieldBlur(subFieldFullName: string, value: any): void {
    // Get the sub-field's KristaField instance
    const subFieldKristaField = this.kristaFields.get(subFieldFullName);
    if (!subFieldKristaField) {
      return;
    }

    // Mark as touched
    subFieldKristaField.markAsTouched();

    // Apply formatting on blur (this will capitalize Person/ProperNoun fields, convert phone strings to objects, etc.)
    if (value) {
      subFieldKristaField.formatOnBlur();
    } else {
      // If empty, validate to show required field errors
      subFieldKristaField.validate();
    }

    // Get the formatted value
    const formattedValue = subFieldKristaField.value;

    // Always update the parent field with the formatted value (even if unchanged)
    // This is important for phone fields which need to be converted from string to object
    const parts = subFieldFullName.split('.');
    const subFieldName = parts.pop() || subFieldFullName;

    // Find the top-level parent field (first part of the dotted name)
    const topLevelParentName = parts[0];
    const parentField = this.formFields.find(f => f.name === topLevelParentName);
    if (parentField) {
      const parentValue = parentField.value || {};
      let updatedValue;

      if (parentField.fieldType === FieldTypes.ENTITY_FIELD) {
        // EntityReference: write formatted value inside 'fields' sub-object
        if (parts.length > 1) {
          // Nested field (e.g., "Entity1.MultiField1.Text1")
          const intermediateFieldName = parts[1];
          const intermediateValue = parentValue.fields?.[intermediateFieldName] || {};
          updatedValue = {
            ...parentValue,
            fields: {
              ...(parentValue.fields || {}),
              [intermediateFieldName]: {
                ...intermediateValue,
                [subFieldName]: formattedValue
              }
            }
          };
        } else {
          // Direct sub-field (e.g., "Entity1.Text1")
          updatedValue = {
            ...parentValue,
            fields: {
              ...(parentValue.fields || {}),
              [subFieldName]: formattedValue
            }
          };
        }
      } else {
        // MultiField/Composite: write at root level of parent value
        if (parts.length > 1) {
          // Nested field (e.g., "Multi1.NestedMulti.Text1")
          const intermediateFieldName = parts[1];
          const intermediateValue = parentValue[intermediateFieldName] || {};
          updatedValue = {
            ...parentValue,
            [intermediateFieldName]: {
              ...intermediateValue,
              [subFieldName]: formattedValue
            }
          };
        } else {
          updatedValue = {
            ...parentValue,
            [subFieldName]: formattedValue
          };
        }
      }

      // Update parent field value
      parentField.value = updatedValue;

      // Update parent KristaField
      const parentKristaField = this.kristaFields.get(parentField.name);
      if (parentKristaField) {
        parentKristaField.setValue(updatedValue);
      }
    }

    // Mark for check to update UI
    this.cdr.markForCheck();
  }

  /**
   * Handle blur event for text fields - apply formatting
   */
  onTextFieldBlur(field: FormField, value: any): void {
    if (this.isFieldReadOnly(field)) {
      return;
    }

    // Use KristaField formatting if available
    const kristaField = this.kristaFields.get(field.name);
    if (kristaField) {
      kristaField.markAsTouched();
      if (value) {
        kristaField.formatOnBlur();
      } else {
        // If empty, validate to show required field errors
        kristaField.validate();
      }
      // Sync back to FormField
      field.value = kristaField.value;
      // Mark for check to show validation errors
      this.cdr.markForCheck();
      return;
    }

    // Fallback: Use toolkit formatting for fields not yet migrated to KristaField
    if (value) {
      const formattedValue = this.kristaFieldService.formatOnBlur(field, value);
      if (formattedValue !== value) {
        field.value = formattedValue;
      }
    }
  }

  /**
   * Handle focus event for number fields
   */
  onNumberFieldFocus(field: FormField): void {
    // Track that this field is focused
    this.focusedFields.add(field.name);
    // Mark for check to update display (remove % for percentage fields)
    this.cdr.markForCheck();
  }

  /**
   * Handle blur event for number fields - apply numeric formatting
   */
  onNumberFieldBlur(field: FormField, value: any): void {
    // Remove from focused fields set
    this.focusedFields.delete(field.name);

    if (this.isFieldReadOnly(field)) {
      return;
    }

    // Use KristaField formatting
    const kristaField = this.kristaFields.get(field.name);
    if (kristaField) {
      kristaField.markAsTouched();
      if (value) {
        kristaField.formatOnBlur();
      } else {
        // If empty, validate to show required field errors
        kristaField.validate();
      }

      // Sync back to FormField
      field.value = kristaField.value;
      // Mark for check to show validation errors and add % for percentage fields
      this.cdr.markForCheck();
      return;
    }

    // Fallback: Use toolkit formatting
    if (value) {
      const formattedValue = this.kristaFieldService.formatOnBlur(field, value);
      if (formattedValue !== value) {
        field.value = formattedValue;
      }
    }
  }



  /**
   * Handle date picker change events
   */
  onDateChange(fieldName: string, event: any): void {
    const date = event.value;
    if (date) {
      // Format date as YYYY-MM-DD for consistency
      const formattedDate = date.toISOString().split('T')[0];
      this.onFieldValueChange(fieldName, formattedDate);
    } else {
      this.onFieldValueChange(fieldName, '');
    }
  }

  /**
   * Get date value for date picker
   */
  getDateValue(field: FormField): Date | null {
    if (!field.value) return null;
    const date = new Date(field.value);
    return isNaN(date.getTime()) ? null : date;
  }

  /**
   * Focus time input when clock icon is clicked
   */
  focusTimeInput(event: Event): void {
    const target = event.target as HTMLElement;
    const input = target.closest('mat-form-field')?.querySelector('input[type="time"]') as HTMLInputElement;
    if (input) {
      input.focus();
      input.showPicker?.(); // Show native time picker if available
    }
  }

  onFileChange(fieldName: string, event: any): void {
    const files = event.target.files;
    if (files && files.length > 0) {
      const field = this.formFields.find(f => f.name === fieldName);
      if (field?.attributeValues?.['multipleFileUpload']) {
        this.onFieldValueChange(fieldName, Array.from(files));
      } else {
        this.onFieldValueChange(fieldName, files[0]);
      }
    }
  }

  getFileAcceptTypes(field: FormField): string {
    const fileTypes = field.attributeValues?.['fileTypes'] || [];
    // Use the same logic as original app
    return getAcceptAttribute(fileTypes);
  }

  getFileDisplayName(value: any): string {
    if (!value) return '';
    if (Array.isArray(value)) {
      return `${value.length} file(s) selected`;
    }
    if (value.name) {
      return value.name;
    }
    return 'File selected';
  }

  getFieldOptions(field: FormField): any[] {
    // Check multiple possible locations for options based on original app structure

    // 1. Check attributeValues['options'] (most common for pick one/many fields)
    if (field.attributeValues?.['options'] && Array.isArray(field.attributeValues['options'])) {
      return field.attributeValues['options'].map((option: any) => ({
        value: option,
        label: option
      }));
    }

    // 2. Check direct options property as array
    if (field.options && Array.isArray(field.options)) {
      return field.options.map((option: any) => ({
        value: option,
        label: option
      }));
    }

    // 3. Check if options is an object with nested structure
    if (field.options && typeof field.options === 'object') {
      const optionsArray = Object.values(field.options);
      if (optionsArray.length > 0 && Array.isArray(optionsArray[0])) {
        return optionsArray[0].map((option: any) => ({
          value: option,
          label: option
        }));
      }
    }

    return [];
  }

  onLocationButtonClick(field: FormField): void {
    if (this.isFieldReadOnly(field)) {
      return;
    }

    // Check if geolocation is supported
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          };

          // Format location as string for display
          const locationString = `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
          this.onFieldValueChange(field.name, locationString);
        },
        (error) => {
          let errorMessage = 'Unable to get location';

          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied. Please grant permission to use location.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information is unavailable.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out.';
              break;
          }

          // You could show this error in a snackbar or alert
          alert(errorMessage);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    } else {
      alert('Geolocation is not supported by this browser.');
    }
  }

  /**
   * TrackBy function for radio button options
   */
  trackByOption(index: number, option: any): any {
    return option.value;
  }

  /**
   * TrackBy function for form fields
   */
  trackByField(index: number, field: FormField): string {
    return field.name;
  }

  /**
   * TrackBy function for error messages
   */
  trackByError(index: number, error: string): string {
    return error;
  }
}
