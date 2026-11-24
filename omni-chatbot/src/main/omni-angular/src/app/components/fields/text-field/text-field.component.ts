import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { FormField } from '../../../models/message.model';
import { TextFieldConfig } from '../../../models/field-config.model';
import { TranslateService } from '@ngx-translate/core';
import { getFieldLabel } from '../shared/field-label.utils';

/**
 * Pure presentation component for text-based input fields.
 * This component only handles rendering and user interaction.
 * All business logic (formatting, validation, etc.) is handled by the parent.
 */
@Component({
  selector: 'app-text-field',
  templateUrl: './text-field.component.html',
  styleUrls: ['./text-field.component.css'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TextFieldComponent implements AfterViewInit {
  @ViewChild('autoTextarea') autoTextarea?: ElementRef<HTMLTextAreaElement>;

  /**
   * Controls the .is-scrollable class. The scrollbar is hidden by default to
   * suppress the sub-pixel phantom scrollbar cdkTextareaAutosize produces on
   * fractional-DPI displays, and only shown when content genuinely overflows max-rows.
   */
  isScrollable = false;

  // Data inputs
  @Input() field!: FormField;
  @Input() config: TextFieldConfig = {
    displayValue: '',
    inputType: 'text',
    hasError: false,
    errorMessage: '',
    readOnly: false,
    placeholder: undefined,
    rows: 1 // Reduced from 4 to 2 for normal height
  };

  // Event outputs (emit raw values, parent handles business logic)
  @Output() valueChange = new EventEmitter<any>();
  @Output() blur = new EventEmitter<any>();
  @Output() focus = new EventEmitter<void>();
  @Output() keyPress = new EventEmitter<KeyboardEvent>();

  constructor(private translate: TranslateService, private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    // Handle pre-filled long values rendered on init.
    this.updateScrollbarVisibility();
  }

  /**
   * Show the scrollbar only on real overflow past max-rows. cdkTextareaAutosize
   * sizes the box to fit content, so a short/empty field overflows by <1px (sub-pixel
   * rounding); a genuine overflow is a full line (~line-height px). A few-px threshold
   * cleanly separates the two. Read after layout via rAF so CDK has resized first.
   */
  private updateScrollbarVisibility(): void {
    const el = this.autoTextarea?.nativeElement;
    if (!el) {
      return;
    }
    requestAnimationFrame(() => {
      const scrollable = el.scrollHeight - el.clientHeight > 4;
      if (scrollable !== this.isScrollable) {
        this.isScrollable = scrollable;
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * Handle value changes - emit raw value to parent
   * For phone fields, filter out invalid characters
   */
  onValueChange(value: any): void {
    // Phone field input filtering - remove any characters that aren't numbers, +, -, (, ), or space
    if (this.field.fieldType === 'com.krista.fields.Phone' && typeof value === 'string') {
      const filteredValue = value.replace(/[^0-9+\-() ]/g, '');
      if (filteredValue !== value) {
        // Value was filtered, emit the cleaned value
        this.valueChange.emit(filteredValue);
        this.updateScrollbarVisibility();
        return;
      }
    }

    this.valueChange.emit(value);
    this.updateScrollbarVisibility();
  }

  /**
   * Handle blur event - emit raw value to parent for formatting
   */
  onBlur(value: any): void {
    this.blur.emit(value);
  }

  /**
   * Handle focus event
   */
  onFocus(): void {
    this.focus.emit();
  }

  /**
   * Block Enter (and Shift+Enter) from inserting newlines in single-line text fields.
   * Soft-wrap via CSS handles overflow; Paragraph fields keep multiline behavior.
   */
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && this.field.fieldType !== 'com.krista.fields.Paragraph') {
      event.preventDefault();
      if (!event.shiftKey) {
        this.keyPress.emit(event);
      }
    }
  }

  /**
   * Handle keypress event - emit to parent for validation
   * For phone fields, only allow numbers, +, -, (, ), and space
   */
  onKeyPress(event: KeyboardEvent): void {
    // Phone field input filtering
    if (this.field.fieldType === 'com.krista.fields.Phone') {
      const key = event.key;
      const allowedChars = /[0-9+\-() ]/;

      // Allow control keys (backspace, delete, arrow keys, etc.)
      if (event.ctrlKey || event.metaKey || key === 'Backspace' || key === 'Delete' ||
          key === 'ArrowLeft' || key === 'ArrowRight' || key === 'Tab') {
        this.keyPress.emit(event);
        return;
      }

      // Block any character that's not a number, +, -, (, ), or space
      if (!allowedChars.test(key)) {
        event.preventDefault();
        return;
      }
    }

    this.keyPress.emit(event);
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
   * Get field label - supports both displayLabel (from backend i18n) and displayName
   * Priority: displayLabel > displayName > name
   * Uses shared utility function for consistency across all field types
   */
  getFieldLabel(): string {
    return getFieldLabel(this.field);
  }

  /**
   * Presentation logic: Get placeholder text
   * Uses translation service like original app does
   */
  getPlaceholder(): string {
    // Use custom placeholder if provided, otherwise generate default
    if (this.config.placeholder !== undefined) {
      return this.config.placeholder;
    }

    if (this.isFieldReadOnly()) {
      return '';
    }

    // Use displayName if available (for sub-fields), otherwise use name
    const fieldName = this.field.displayName || this.field.name;
    // Use translation service like: t("placeholder.enter", { fieldName })
    return this.translate.instant('placeholder.enter', { fieldName });
  }

  /**
   * Presentation logic: Get display value
   * Uses pre-formatted displayValue from parent if available,
   * otherwise falls back to raw field value
   */
  getDisplayValue(): string {
    // Use pre-formatted display value from parent if provided
    if (this.config.displayValue !== undefined && this.config.displayValue !== null) {
      return this.config.displayValue;
    }

    // Fallback to raw field value
    if (this.field.value === null || this.field.value === undefined) {
      return '';
    }

    return this.field.value.toString();
  }

  /**
   * Presentation logic: Get input type
   * Returns 'tel' for phone fields to show numeric keyboard on mobile
   */
  getInputType(): string {
    if (this.field.fieldType === 'com.krista.fields.Phone') {
      return 'tel';
    }
    return 'text';
  }

  /**
   * Check if the field is secured (values should be masked)
   */
  isSecured(): boolean {
    return this.field.attributeValues?.['isSecured'] === true;
  }

  /**
   * Presentation logic: Get auto-capitalization setting
   * Matches krista-client's AutoCapitalizeField behavior
   */
  getAutoCapitalize(): string {
    // Check if field has autoCapitalize attribute
    const autoCapitalize = this.field.attributeValues?.['autoCapitalize'];
    if (autoCapitalize) {
      return autoCapitalize;
    }

    // Default: no auto-capitalization
    return 'none';
  }

  /**
   * Get minimum rows for textarea auto-resize
   * Matches original TextRenderer: minRows={1}
   */
  getMinRows(): number {
    // Paragraph fields start with 2 rows for better UX
    if (this.field.fieldType === 'com.krista.fields.Paragraph') {
      return 2;
    }
    // Regular text fields start with 1 row (matches original)
    return 1;
  }

  /**
   * Get maximum rows for textarea auto-resize
   * Matches original TextRenderer: maxRows={4} (default)
   */
  getMaxRows(): number {
    // Paragraph fields can expand more
    if (this.field.fieldType === 'com.krista.fields.Paragraph') {
      return 5;
    }
    // Regular text fields max 4 rows (matches original default)
    return 4;
  }
}
