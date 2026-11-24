import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';

/**
 * StatusOverlayComponent
 *
 * Displays a polished "processing" indicator with rotating status messages.
 * Uses CSS opacity transitions on a persistent element instead of *ngIf
 * toggling to avoid layout-shift flicker when text changes.
 */
@Component({
  selector: 'app-status-overlay',
  standalone: false,
  templateUrl: './status-overlay.component.html',
  styleUrl: './status-overlay.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatusOverlayComponent implements OnInit, OnDestroy, OnChanges {
  @Input() messages: string[] = [];
  @Input() imageUrl: string | null = null;

  currentMessage: string = '';
  textVisible: boolean = true;

  private rotationInterval: ReturnType<typeof setInterval> | null = null;
  private fadeTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly ROTATION_INTERVAL_MS = 2400;
  private readonly FADE_DURATION_MS = 400;
  private readonly PAUSE_BETWEEN_MS = 300;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.startRotation();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['messages'] && !changes['messages'].firstChange) {
      // Keep the in-flight rotation if the message currently on screen is still present
      // in the new list — prevents a jarring text jump when overlapping status updates
      // arrive. Only restart when the shown message is gone (or nothing is showing yet).
      if (!this.currentMessage || !this.messages.includes(this.currentMessage)) {
        this.restartRotation();
      }
    }
  }

  ngOnDestroy(): void {
    this.clearAll();
  }

  private startRotation(): void {
    if (!this.messages.length) {
      return;
    }

    this.currentMessage = this.pickRandom();
    this.textVisible = true;
    this.cdr.markForCheck();

    if (this.messages.length > 1) {
      this.rotationInterval = setInterval(() => {
        this.rotateMessage();
      }, this.ROTATION_INTERVAL_MS);
    }
  }

  private rotateMessage(): void {
    // Fade out via CSS transition
    this.textVisible = false;
    this.cdr.markForCheck();

    // After fade-out + pause, swap text and fade back in
    this.fadeTimeout = setTimeout(() => {
      this.currentMessage = this.pickRandom();
      this.textVisible = true;
      this.cdr.markForCheck();
    }, this.FADE_DURATION_MS + this.PAUSE_BETWEEN_MS);
  }

  private clearAll(): void {
    if (this.rotationInterval !== null) {
      clearInterval(this.rotationInterval);
      this.rotationInterval = null;
    }
    if (this.fadeTimeout !== null) {
      clearTimeout(this.fadeTimeout);
      this.fadeTimeout = null;
    }
  }

  private restartRotation(): void {
    this.clearAll();
    this.startRotation();
  }

  private pickRandom(): string {
    if (!this.messages.length) {
      return '';
    }
    const idx = Math.floor(Math.random() * this.messages.length);
    return this.messages[idx];
  }
}
