import { Component, Input, Output, EventEmitter, forwardRef, OnChanges, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-text-input-area',
  standalone: false,
  templateUrl: './text-input-area.component.html',
  styleUrl: './text-input-area.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TextInputAreaComponent),
      multi: true
    }
  ]
})
export class TextInputAreaComponent implements ControlValueAccessor, OnChanges, OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  @Input() placeholder: string = '';
  @Input() disabled: boolean = false;
  @Input() value: string = '';
  @Output() enterKeyPress = new EventEmitter<KeyboardEvent>();
  @Output() valueChange = new EventEmitter<string>();

  // Reactive placeholder that updates on language change
  translatedPlaceholder: string = '';

  private onChange = (value: string) => {};
  private onTouched = () => {};

  constructor(
    private translateService: TranslateService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Subscribe to language changes and update placeholder
    this.translateService.onLangChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updatePlaceholder();
      });

    // Subscribe to translation load events (for initial load and language changes)
    this.translateService.onTranslationChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updatePlaceholder();
      });

    // Initial placeholder update (will use current language)
    this.updatePlaceholder();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnChanges(): void {
    // Update placeholder when input changes
    this.updatePlaceholder();
  }

  private updatePlaceholder(): void {
    // If placeholder is a translation key, translate it
    if (this.placeholder) {
      // Use get() Observable to handle async translation loading
      this.translateService.get(this.placeholder).subscribe({
        next: (translated) => {
          // Only update if we got a valid translation (not the key itself)
          if (translated && translated !== this.placeholder) {
            this.translatedPlaceholder = translated;
          } else {
            // Fallback: try instant translation
            const instant = this.translateService.instant(this.placeholder);
            this.translatedPlaceholder = instant !== this.placeholder ? instant : '';
          }
          this.cdr.markForCheck();
        },
        error: () => {
          // On error, try instant translation as fallback
          this.translatedPlaceholder = this.translateService.instant(this.placeholder);
          this.cdr.markForCheck();
        }
      });
    } else {
      this.translatedPlaceholder = '';
    }
  }

  handleChange(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.value = target.value;
    this.valueChange.emit(this.value);
    this.onChange(this.value);
  }

  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text') ?? '';
    const cleaned = pasted.replace(/[\r\n]+$/, '');
    document.execCommand('insertText', false, cleaned);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      if (event.shiftKey) {
        // Allow new line with Shift+Enter
        return;
      } else if (this.value.trim()) {
        // Emit enter key press event if there's content
        this.enterKeyPress.emit(event);
        event.preventDefault();
      }
    }
  }

  onBlur(): void {
    this.onTouched();
  }

  // ControlValueAccessor implementation
  writeValue(value: string): void {
    this.value = value || '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
