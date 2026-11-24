import { Component, EventEmitter, Output, ChangeDetectionStrategy } from '@angular/core';

/**
 * BootFailedComponent
 *
 * Shown when the chat could not be started at all — login failed with no
 * reusable stored session, or session creation failed. Without it the user is
 * left staring at an empty pane (previously with a spinner re-armed by the
 * fallback session call) and no indication that anything went wrong.
 *
 * <p>Distinct from two neighbouring states:
 *   - the host "We'll be back soon" overlay, which covers server-unreachable
 *     (status 0/502/503/504) and is triggered from AppFacade instead of this;
 *   - InactivityDisconnectedComponent, which ends an established session.
 * This one means the session never started.
 *
 * <p>Reuses the inactivity-disconnected stylesheet deliberately: both are the
 * same overlay treatment, and sharing keeps them from drifting apart visually.
 */
@Component({
  selector: 'app-boot-failed',
  standalone: false,
  templateUrl: './boot-failed.component.html',
  styleUrls: ['../inactivity-disconnected/inactivity-disconnected.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BootFailedComponent {
  /** Emitted when the user clicks Try Again */
  @Output() retry = new EventEmitter<void>();
  /** Emitted when the user chooses to close the chat instead of retrying */
  @Output() close = new EventEmitter<void>();

  onRetry(): void {
    this.retry.emit();
  }

  onClose(): void {
    this.close.emit();
  }
}
