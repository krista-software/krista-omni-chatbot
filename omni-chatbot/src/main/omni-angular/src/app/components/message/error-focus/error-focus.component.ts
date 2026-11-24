import { Component, Input, OnChanges, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-error-focus',
  standalone: false,
  template: '', // This component has no template - it's purely functional
  styleUrl: './error-focus.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ErrorFocusComponent implements OnChanges {
  @Input() executionId: string = '';
  @Input() errorFields: string[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['errorFields'] && this.errorFields && this.errorFields.length > 0) {
      this.focusOnFirstError();
    }
  }

  private focusOnFirstError(): void {
    if (this.errorFields && this.errorFields.length > 0 && this.executionId) {
      const elementId = `${this.executionId}_${this.errorFields[0].replace(/ /g, '_')}`;
      const element = document.getElementById(elementId);
      
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
          inline: 'start'
        });
        
        // Try to focus the element if it's focusable
        if (element instanceof HTMLElement) {
          element.focus();
        }
      }
    }
  }
}
