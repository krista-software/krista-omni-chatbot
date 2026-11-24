import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { KSDKMessage, MessageType } from '../../../../ui-toolkit-src-angular';

@Component({
  selector: 'app-ephemeral',
  standalone: false,
  templateUrl: './ephemeral.component.html',
  styleUrl: './ephemeral.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EphemeralComponent implements OnInit, OnDestroy {
  @Input() message!: KSDKMessage;
  @Input() ephemeralTime: { start: number; end: number } = { start: 0, end: 0 };
  @Output() freezeInput = new EventEmitter<boolean>();

  timeElapsedPercent: number = 0;
  private expiryTimer: any;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    if (this.ephemeralTime && this.ephemeralTime.end > 0) {
      const startTime = this.ephemeralTime.start;
      const endTime = this.ephemeralTime.end;
      const timePassed = this.calcTimeElapsedPercent(startTime, endTime);

      this.timeElapsedPercent = timePassed;

      if (timePassed >= 100) {
        if (this.message.form) {
          this.message.form.readOnly = true;
        }
        this.freezeInput.emit(true);
      } else {
        this.startTimer(startTime, endTime);
      }
    }
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  get tooltipText(): string {
    if (this.ephemeralTime.end) {
      return new Date(this.ephemeralTime.end).toLocaleString();
    }
    return '';
  }

  private startTimer(startTime: number, endTime: number): void {
    this.stopTimer();

    const optimalInterval = this.calcOptimalInterval(startTime, endTime, 1000);

    this.expiryTimer = setTimeout(() => {
      const newCalcTime = this.calcTimeElapsedPercent(startTime, endTime);
      this.timeElapsedPercent = newCalcTime;

      if (newCalcTime >= 100) {
        if (this.message.form) {
          this.message.form.readOnly = true;
        }
        this.freezeInput.emit(true);
        this.stopTimer();
      } else {
        this.startTimer(startTime, endTime);
      }
      this.cdr.detectChanges();
    }, optimalInterval);
  }

  private stopTimer(): void {
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
  }

  private calcTimeElapsedPercent(startTime: number, endTime: number): number {
    const now = Date.now();
    const totalTime = endTime - startTime;
    const elapsedTime = now - startTime;

    if (elapsedTime <= 0) return 0;
    if (elapsedTime >= totalTime) return 100;

    return (elapsedTime / totalTime) * 100;
  }

  private calcOptimalInterval(startTime: number, endTime: number, maxInterval: number): number {
    const remainingTime = endTime - Date.now();

    if (remainingTime <= 0) return 100;

    const interval = Math.min(maxInterval, remainingTime / 10);
    return Math.max(100, interval);
  }
}
