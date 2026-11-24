import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { ConcurrencyConfigService } from './concurrency-config.service';
import { AdmissionService } from './admission.service';
import { AuthApiService } from './auth-api.service';
import { ClientApiService } from './client-api.service';

/** Phases of the idle-disconnect lifecycle */
export type IdlePhase = 'active' | 'warning' | 'disconnected';

export interface IdleState {
  phase: IdlePhase;
  /** Seconds until disconnect when phase === 'warning' */
  warningCountdownSeconds: number;
}

/**
 * IdleActivityService
 *
 * Monitors user activity (click, keydown, scroll, mousemove, touchstart) on
 * the document.  Uses a throttled handler so the timer is only reset at most
 * once per 500 ms.
 *
 * Cross-tab coordination via BroadcastChannel keyed by the chatbot session so
 * activity in ANY same-origin tab resets the timer in all tabs.  The idle
 * timeout fires only when the tab reporting "inactive" has not seen a
 * cross-tab activity ping within the disconnect window.
 *
 * Timeline (all times from last activity):
 *   0 ─────────── (disconnectMs - warningLeadMs) ──── disconnectMs
 *                        ↑ show warning modal            ↑ disconnect
 *
 * MUST be started only after admission is granted (hasSlot=true) and only
 * when concurrencyControlEnabled === true.
 *
 * This service is completely independent of the existing 1008 session-timeout
 * path — it does not touch markSessionTimedOut or any WebSocket close-code
 * handling.
 */
@Injectable({
  providedIn: 'root'
})
export class IdleActivityService implements OnDestroy {
  private stateSubject = new BehaviorSubject<IdleState>({ phase: 'active', warningCountdownSeconds: 0 });
  readonly idleState$: Observable<IdleState> = this.stateSubject.asObservable();

  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private warningTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private destroy$ = new Subject<void>();
  private started = false;
  private lastActivityTime = Date.now();
  private throttleTimeout: ReturnType<typeof setTimeout> | null = null;
  private channel: BroadcastChannel | null = null;
  private readonly CHANNEL_PREFIX = 'krista-chatbot-idle-';
  private readonly ACTIVITY_THROTTLE_MS = 500;
  private boundActivityHandler: () => void;
  private readonly ACTIVITY_EVENTS = ['click', 'keydown', 'scroll', 'mousemove', 'touchstart'];

  constructor(
    private ngZone: NgZone,
    private concurrencyConfig: ConcurrencyConfigService,
    private admissionService: AdmissionService,
    private authApiService: AuthApiService,
    private clientApiService: ClientApiService
  ) {
    this.boundActivityHandler = this.onActivity.bind(this);
  }

  /**
   * Start monitoring.  Call once after admission is granted.
   * sessionKey is used to namespace the BroadcastChannel so different chatbot
   * instances on the same origin don't interfere.
   */
  start(sessionKey: string): void {
    if (this.started) return;
    this.started = true;
    this.lastActivityTime = Date.now();
    this.setupBroadcastChannel(sessionKey);
    // Run event listeners outside Angular zone to avoid triggering change
    // detection on every mousemove/scroll.
    this.ngZone.runOutsideAngular(() => {
      this.ACTIVITY_EVENTS.forEach(evt =>
        document.addEventListener(evt, this.boundActivityHandler, { passive: true })
      );
    });
    this.scheduleTimers();
    this.setupPagehide();
  }

  /** Stop monitoring and clean up. */
  stop(): void {
    if (!this.started) return;
    this.started = false;
    this.clearAllTimers();
    this.ACTIVITY_EVENTS.forEach(evt =>
      document.removeEventListener(evt, this.boundActivityHandler)
    );
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.setState({ phase: 'active', warningCountdownSeconds: 0 });
  }

  /**
   * Called when the user explicitly confirms they are still here (idle warning
   * modal "I'm still here" button).  Resets the timer and hides the warning.
   */
  resetOnUserConfirmation(): void {
    this.recordActivity(true);
  }

  ngOnDestroy(): void {
    this.stop();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // -------------------------------------------------------------------------

  private onActivity(): void {
    if (this.throttleTimeout) return;
    this.throttleTimeout = setTimeout(() => {
      this.throttleTimeout = null;
      this.recordActivity(false);
    }, this.ACTIVITY_THROTTLE_MS);
  }

  private recordActivity(fromConfirmation: boolean): void {
    this.lastActivityTime = Date.now();
    // Broadcast to other tabs
    if (this.channel) {
      try {
        this.channel.postMessage({ type: 'activity', ts: this.lastActivityTime });
      } catch { /* ignore */ }
    }
    const currentPhase = this.stateSubject.value.phase;
    if (currentPhase === 'disconnected') return;
    // Only auto-reset the warning if coming from the confirmation button.
    // Incidental activity (clicks on the chat UI) does NOT dismiss the modal.
    if (currentPhase === 'warning' && !fromConfirmation) return;
    this.ngZone.run(() => {
      this.clearAllTimers();
      this.setState({ phase: 'active', warningCountdownSeconds: 0 });
      this.scheduleTimers();
    });
  }

  private scheduleTimers(): void {
    const disconnectMs = this.concurrencyConfig.idleDisconnectMs();
    const warningLeadMs = this.concurrencyConfig.idleWarningLeadMs();
    if (disconnectMs <= 0) return;
    const warningAt = disconnectMs - warningLeadMs;
    if (warningAt > 0) {
      this.warningTimer = setTimeout(() => {
        this.ngZone.run(() => this.showWarning(warningLeadMs));
      }, warningAt);
    }
    this.disconnectTimer = setTimeout(() => {
      this.ngZone.run(() => this.triggerDisconnect());
    }, disconnectMs);
  }

  private showWarning(warningLeadMs: number): void {
    const leadSeconds = Math.round(warningLeadMs / 1000);
    this.setState({ phase: 'warning', warningCountdownSeconds: leadSeconds });
    // Run a 1-second countdown so the modal can display live seconds
    let remaining = leadSeconds;
    this.countdownInterval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        this.clearCountdown();
        return;
      }
      this.setState({ phase: 'warning', warningCountdownSeconds: remaining });
    }, 1000);
  }

  private triggerDisconnect(): void {
    this.clearAllTimers();
    // Free the admission slot so the next queued user can be admitted
    this.admissionService.leave();
    // Close the WebSocket from the client side
    this.clientApiService.disconnect();
    // Call logout API — backend frees the concurrency seat immediately,
    // deletes the auth session, and expires the HttpOnly cookie via Set-Cookie.
    // Show the disconnect screen only after the call completes so the session
    // is fully torn down before the user can click "Reconnect".
    this.authApiService.logout().subscribe({
      next: () => this.setState({ phase: 'disconnected', warningCountdownSeconds: 0 }),
      error: () => this.setState({ phase: 'disconnected', warningCountdownSeconds: 0 })
    });
  }

  private clearAllTimers(): void {
    if (this.warningTimer) { clearTimeout(this.warningTimer); this.warningTimer = null; }
    if (this.disconnectTimer) { clearTimeout(this.disconnectTimer); this.disconnectTimer = null; }
    this.clearCountdown();
  }

  private clearCountdown(): void {
    if (this.countdownInterval) { clearInterval(this.countdownInterval); this.countdownInterval = null; }
  }

  private setupBroadcastChannel(sessionKey: string): void {
    if (typeof BroadcastChannel === 'undefined') return;
    try {
      this.channel = new BroadcastChannel(`${this.CHANNEL_PREFIX}${sessionKey}`);
      this.channel.onmessage = (event) => {
        if (event.data?.type === 'activity') {
          // Another tab is active: reset our timers without broadcasting again
          this.ngZone.runOutsideAngular(() => {
            this.lastActivityTime = event.data.ts || Date.now();
          });
          const phase = this.stateSubject.value.phase;
          if (phase === 'disconnected') return;
          if (phase === 'warning') return; // cross-tab activity does NOT dismiss warning modal
          this.ngZone.run(() => {
            this.clearAllTimers();
            this.setState({ phase: 'active', warningCountdownSeconds: 0 });
            this.scheduleTimers();
          });
        }
      };
    } catch { /* BroadcastChannel unavailable in some environments */ }
  }

  private setupPagehide(): void {
    // Called once; listener is lightweight and we don't track it for removal
    // because the page is unloading anyway.
    const handler = () => {
      const phase = this.stateSubject.value.phase;
      // Release the slot if we hold one (active or warning = slot held; disconnected = already released)
      if (phase === 'active' || phase === 'warning') {
        this.admissionService.leave();
      }
    };
    window.addEventListener('pagehide', handler);
    window.addEventListener('beforeunload', handler);
  }

  private setState(state: IdleState): void {
    this.stateSubject.next(state);
  }
}
