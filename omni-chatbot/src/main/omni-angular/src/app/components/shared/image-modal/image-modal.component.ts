import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';

/**
 * ImageModalComponent
 *
 * A modal component for displaying images in full-screen preview with zoom capability.
 * Clicking outside the image or on the close button dismisses the modal.
 *
 * (originally ported from the React chatbot)
 */
@Component({
  selector: 'app-image-modal',
  standalone: false,
  templateUrl: './image-modal.component.html',
  styleUrl: './image-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImageModalComponent {
  /**
   * The source URL of the image to display
   */
  @Input() imageSrc: string = '';

  /**
   * The alt text for the image
   */
  @Input() altText: string = 'Image';

  /**
   * Emits when the modal should be closed
   */
  @Output() close = new EventEmitter<void>();

  /**
   * Handle close button click
   */
  onClose(): void {
    this.close.emit();
  }

  /**
   * Handle overlay click (clicking outside the image)
   */
  onOverlayClick(): void {
    this.close.emit();
  }

  /**
   * Prevent clicks on the image itself from closing the modal
   */
  onImageClick(event: Event): void {
    event.stopPropagation();
  }
}

