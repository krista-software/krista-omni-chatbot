import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';

/**
 * IdleWarningModalComponent
 *
 * Full-screen overlay shown when the idle timer crosses the warning threshold.
 * Displays a live countdown to disconnect.
 *
 * The modal is dismissed ONLY by the explicit "I'm still here" button.
 * Incidental user activity (clicking elsewhere in the chat) does NOT dismiss
 * it — this is intentional: once the warning fires, only explicit confirmation
 * resets the idle timer (see IdleActivityService.recordActivity()).
 *
 * The parent (AppComponent) is responsible for removing this component from
 * the DOM when the user confirms or when the disconnect fires.
 */
@Component({
  selector: 'app-idle-warning-modal',
  standalone: false,
  templateUrl: './idle-warning-modal.component.html',
  styleUrls: ['./idle-warning-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IdleWarningModalComponent {
  /** SVG ring radius (matches the viewBox in the template). */
  private static readonly RING_RADIUS = 46;
  /** Full circumference of the progress ring. */
  readonly circumference = 2 * Math.PI * IdleWarningModalComponent.RING_RADIUS;

  private _countdownSeconds = 0;
  // The largest countdown value seen since the warning appeared (i.e. the warning
  // lead time). Captured from the first bound value so the progress ring knows what
  // "full" is without the parent having to pass the total separately.
  private _maxSeconds = 0;

  /** Live countdown seconds fed from IdleActivityService.idleState$ */
  @Input()
  set countdownSeconds(value: number) {
    this._countdownSeconds = value > 0 ? value : 0;
    if (this._countdownSeconds > this._maxSeconds) {
      this._maxSeconds = this._countdownSeconds;
    }
  }
  get countdownSeconds(): number {
    return this._countdownSeconds;
  }

  /** Emitted when the user clicks "I'm still here" */
  @Output() stillHere = new EventEmitter<void>();

  /**
   * stroke-dashoffset for the progress arc: the ring is full (offset 0) at the
   * start and empties (offset = circumference) as the countdown reaches zero.
   */
  get dashOffset(): number {
    const fraction = this._maxSeconds > 0 ? this._countdownSeconds / this._maxSeconds : 0;
    const clamped = Math.max(0, Math.min(1, fraction));
    return this.circumference * (1 - clamped);
  }

  onStillHere(): void {
    this.stillHere.emit();
  }
}
