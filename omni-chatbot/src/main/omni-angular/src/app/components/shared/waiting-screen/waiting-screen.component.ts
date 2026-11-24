import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';

/**
 * WaitingScreenComponent
 *
 * Shown in place of the chat while the user is queued for a concurrent-user
 * slot. Displays the live queue position and a Close action (collapses the
 * widget, same as the header close).
 */
@Component({
  selector: 'app-waiting-screen',
  standalone: false,
  templateUrl: './waiting-screen.component.html',
  styleUrls: ['./waiting-screen.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WaitingScreenComponent {
  @Input() position: number = 0;
  /** Retained for compatibility with the admission-state binding; not displayed. */
  @Input() estimatedWaitMs: number = 0;
  /** Emitted when the user closes the chat while waiting. */
  @Output() close = new EventEmitter<void>();

  onClose(): void {
    this.close.emit();
  }
}
