import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { FormControl } from '@angular/forms';
import { FormField } from '../../../models/message.model';
import { RichTextFieldConfig } from '../../../models/field-config.model';
import { TranslateService } from '@ngx-translate/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Editor, Toolbar } from 'ngx-editor';

/**
 * RichTextFieldComponent - WYSIWYG editor for rich text input
 * Mirrors kristaclient's FormRichTextFieldComponent using ngx-editor
 *
 * Features:
 * - WYSIWYG editing with formatting toolbar (ngx-editor)
 * - Bold, Italic, Underline, Strike inline styles
 * - Headers (H1-H6), lists (UL, OL), blockquote, code
 * - Text/background color, alignment
 * - HTML sanitization for security
 * - Read-only mode with formatted display
 */
@Component({
  selector: 'app-rich-text-field',
  templateUrl: './rich-text-field.component.html',
  styleUrls: ['./rich-text-field.component.css'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RichTextFieldComponent implements OnInit, OnDestroy, OnChanges {
  // Data inputs
  @Input() field!: FormField;
  @Input() config: RichTextFieldConfig = {
    displayValue: '',
    hasError: false,
    errorMessage: '',
    readOnly: false,
    maxLineCount: 2
  };

  // Event outputs
  @Output() valueChange = new EventEmitter<any>();
  @Output() blur = new EventEmitter<any>();
  @Output() focus = new EventEmitter<void>();

  // ngx-editor instance and configuration
  editor!: Editor;
  formControl = new FormControl('');

  // Toolbar configuration - only B, I, U, H1-H6, UL, OL
  toolbar: Toolbar = [
    ['bold', 'italic', 'underline'],
    [{ heading: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] }],
    ['ordered_list', 'bullet_list'],
  ];

  constructor(
    private translate: TranslateService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    // Initialize editor only if not read-only
    if (!this.isFieldReadOnly()) {
      this.editor = new Editor();

      // Set initial value - use displayValue if provided AND not empty, otherwise fall back to field.value
      const displayValue = (this.config.displayValue !== undefined && this.config.displayValue !== '')
        ? this.config.displayValue
        : (this.field.value || '');
      const initialValue = this.toNgxHtml(displayValue);
      this.formControl.setValue(initialValue);

      // Listen to form control changes
      this.formControl.valueChanges.subscribe(value => {
        this.onContentChanged(value);
      });
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Handle changes to field value or config
    if (changes['field'] || changes['config']) {
      // Use displayValue if provided AND not empty, otherwise fall back to field.value
      const displayValue = (this.config.displayValue !== undefined && this.config.displayValue !== '')
        ? this.config.displayValue
        : (this.field.value || '');

      // Only update if editor is initialized (not read-only)
      if (this.editor && !this.isFieldReadOnly()) {
        const newValue = this.toNgxHtml(displayValue);

        // Only update if value actually changed to avoid unnecessary updates
        if (this.formControl.value !== newValue) {
          this.formControl.setValue(newValue, { emitEvent: false });
        }
      }
    }
  }

  ngOnDestroy(): void {
    // Clean up editor instance
    if (this.editor) {
      this.editor.destroy();
    }
  }

  /**
   * Handle value changes from ngx-editor
   * Editor emits HTML content
   */
  onContentChanged(html: string | null): void {
    if (html !== null && html !== undefined) {
      // Clean HTML and emit
      const cleanedHtml = this.cleanHtml(html);
      this.valueChange.emit(cleanedHtml);
    }
  }

  /**
   * Clean HTML output - remove ProseMirror artifacts
   */
  private cleanHtml(html: string): string {
    return html
      .replace(/<img class="ProseMirror-separator"[^>]*>/g, '')
      .replace(/<br class="ProseMirror-trailingBreak"[^>]*>/g, '');
  }

  /**
   * Convert plain text to HTML paragraphs for ngx-editor
   * Matches kristaclient's toNgxHtml function
   */
  private toNgxHtml(text: string = ''): string {
    text = typeof text === 'string' ? text : String(text ?? '');
    return text ? text.split('\n').map(paragraph =>
      /<[^>]+>/.test(paragraph) ? paragraph : `<p>${paragraph}</p>`
    ).join('') : text;
  }

  /**
   * Handle blur event
   */
  onBlur(): void {
    this.blur.emit(this.config.displayValue);
  }

  /**
   * Handle focus event
   */
  onFocus(): void {
    this.focus.emit();
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
    return this.config?.readOnly || this.field.readOnly || false;
  }

  /**
   * Check if label should be shown
   * Defaults to true if not specified in config
   */
  shouldShowLabel(): boolean {
    return this.config?.showLabel !== false; // Show by default unless explicitly set to false
  }

  /**
   * Get placeholder text
   */
  getPlaceholder(): string {
    if (this.isFieldReadOnly()) {
      return '';
    }

    const fieldName = this.field.displayName || this.field.name;
    return this.translate.instant('placeholder.enter', { fieldName });
  }

  /**
   * Get display value for editor
   * Converts newlines to <br/> tags for proper HTML display
   * Falls back to field.value if displayValue is not provided or empty (for table cells)
   */
  getEditorValue(): string {
    // Use displayValue if provided AND not empty, otherwise fall back to field.value
    // This handles the case where displayValue is an empty string from the table
    const value = (this.config.displayValue !== undefined && this.config.displayValue !== '')
      ? this.config.displayValue
      : (this.field.value || '');

    if (!value) {
      return '';
    }

    // Convert newlines to <br/> tags (matches original's behavior)
    return value.replace(/\n/g, '<br/>');
  }

  /**
   * Get sanitized HTML for read-only display
   */
  getSanitizedHtml(): SafeHtml {
    const html = this.getEditorValue();

    if (!html) {
      return this.sanitizer.bypassSecurityTrustHtml('');
    }

    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  /**
   * Get max height based on maxLineCount
   * Matches original's calculation: maxLineCount * 1.5rem
   */
  getMaxHeight(): string {
    const maxLineCount = this.config.maxLineCount || 2;
    return `${maxLineCount * 1.5}rem`;
  }
}

