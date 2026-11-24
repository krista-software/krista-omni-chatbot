import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { FormField } from '../../../models/message.model';
import { BasicFieldConfig } from '../../../models/field-config.model';
import { getFieldLabel } from '../shared/field-label.utils';

/**
 * Self-contained rating field component.
 * This component handles rating display and interaction internally,
 * making it library-ready with minimal parent dependencies.
 */
@Component({
  selector: 'app-rating-field',
  templateUrl: './rating-field.component.html',
  styleUrls: ['./rating-field.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class RatingFieldComponent {
  // Data inputs
  @Input() field!: FormField;
  @Input() config: BasicFieldConfig = {
    hasError: false,
    errorMessage: '',
    readOnly: false
  };

  // Event outputs
  @Output() valueChange = new EventEmitter<number>();

  /**
   * Get maximum rating value from field attributes
   */
  get maxRating(): number {
    const maxRating = this.field.attributeValues?.['maxRating'];
    if (maxRating && typeof maxRating === 'number' && maxRating > 0) {
      return maxRating;
    }
    return 5; // Default to 5 stars
  }

  /**
   * Get array of star indices for rendering
   */
  get stars(): number[] {
    return Array.from({ length: this.maxRating }, (_, i) => i + 1);
  }

  /**
   * Handle star click
   */
  onStarClick(rating: number): void {
    if (!this.isFieldReadOnly()) {
      this.valueChange.emit(rating);
    }
  }

  /**
   * Check if star should be filled
   */
  isStarFilled(starIndex: number): boolean {
    return (this.field.value || 0) >= starIndex;
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
    return this.config?.showLabel !== false; // Show by default unless explicitly set to false
  }

  /**
   * Get field label with i18n support
   * Uses shared utility function for consistency across all field types
   */
  getFieldLabel(): string {
    return getFieldLabel(this.field);
  }

  /**
   * TrackBy function for stars to prevent unnecessary DOM recreation
   */
  trackByStar(index: number, star: number): number {
    return star;
  }
}
