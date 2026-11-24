import { Component, EventEmitter, Output, ChangeDetectionStrategy } from '@angular/core';

/**
 * InactivityDisconnectedComponent
 *
 * Shown after the idle-disconnect fires (phase === 'disconnected').
 * Visually and behaviourally distinct from the existing session-timeout message:
 *   - Uses a different icon (no signal / sleep)
 *   - Different i18n key group (concurrency.disconnected.*)
 *   - Reconnect triggers the full boot path (including re-admission) via
 *     the (reconnect) output — AppComponent delegates to AppFacade.reconnect().
 *
 * NOTE: this component must NOT reuse or touch the 1008-close / markSessionTimedOut
 * path. It is a fully separate disconnect reason.
 */
@Component({
  selector: 'app-inactivity-disconnected',
  standalone: false,
  templateUrl: './inactivity-disconnected.component.html',
  styleUrls: ['./inactivity-disconnected.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InactivityDisconnectedComponent {
  /** Emitted when the user clicks the reconnect button */
  @Output() reconnect = new EventEmitter<void>();
  /** Emitted when the user chooses to close the chat instead of reconnecting */
  @Output() close = new EventEmitter<void>();

  onReconnect(): void {
    this.reconnect.emit();
  }

  onClose(): void {
    this.close.emit();
  }
}
