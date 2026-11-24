import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { FormField } from '../../../models/message.model';
import { KristaField } from '../../../models/krista-field.model';

/**
 * ComplexFieldModalComponent - Modal dialog for displaying complex fields (MultiField/Composite/EntityReference)
 * 
 * This component is used when complex fields appear inside table cells.
 * Instead of rendering inline (which would be too cramped), we show an "Open" button
 * that opens this modal dialog with the full field rendered inside.
 * 
 * Mirrors original's ComplexFieldModal component.
 */
@Component({
  selector: 'app-complex-field-modal',
  templateUrl: './complex-field-modal.component.html',
  styleUrls: ['./complex-field-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class ComplexFieldModalComponent {
  /**
   * The complex field to display in the modal
   */
  @Input() field!: FormField;

  /**
   * Sub-fields for MultiField/Composite/EntityReference
   */
  @Input() subFields: FormField[] = [];

  /**
   * Map of KristaField instances for validation and formatting
   */
  @Input() kristaFields!: Map<string, KristaField>;

  /**
   * Whether form submission has been attempted (for validation display)
   */
  @Input() hasAttemptedSubmit: boolean = false;

  /**
   * Workspace ID for file uploads
   */
  @Input() workspaceId: string = '';

  /**
   * Client session ID for file uploads
   */
  @Input() clientSessionId: string = '';

  /**
   * Emits when the modal should be closed
   */
  @Output() close = new EventEmitter<void>();

  /**
   * Emits when a sub-field value changes
   */
  @Output() subFieldValueChange = new EventEmitter<{fieldName: string, value: any}>();

  /**
   * Emits when the field value changes directly (e.g., List field emits its entire array)
   */
  @Output() valueChange = new EventEmitter<any>();

  /**
   * Emits when a sub-field loses focus
   */
  @Output() subFieldBlur = new EventEmitter<{fieldName: string, value: any}>();

  /**
   * Handle close button click
   */
  onClose(): void {
    this.close.emit();
  }

  /**
   * Handle overlay click (clicking outside the content)
   */
  onOverlayClick(): void {
    this.close.emit();
  }

  /**
   * Prevent clicks on the content from closing the modal
   */
  onContentClick(event: Event): void {
    event.stopPropagation();
  }

  /**
   * Handle sub-field value change
   */
  onSubFieldValueChange(event: {fieldName: string, value: any}): void {
    this.subFieldValueChange.emit(event);
  }

  /**
   * Handle direct value change (e.g., from List field)
   */
  onValueChange(value: any): void {
    this.valueChange.emit(value);
  }

  /**
   * Handle sub-field blur
   */
  onSubFieldBlur(event: {fieldName: string, value: any}): void {
    this.subFieldBlur.emit(event);
  }

  /**
   * Handle key press (propagate to parent)
   */
  onKeyPress(event: KeyboardEvent): void {
    // Don't propagate key events from modal
    event.stopPropagation();
  }
}

