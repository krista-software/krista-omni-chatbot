import { Injectable, OnDestroy } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, timer, of } from 'rxjs';
import { switchMap, takeUntil, catchError } from 'rxjs/operators';
import { AuthApiService, QueuedLoginResponse } from './auth-api.service';
import { ConcurrencyConfigService } from './concurrency-config.service';
import { AuthData } from '../models/api.model';

/** Phase exposed to the view */
export type AdmissionPhase = 'idle' | 'requesting' | 'queued' | 'admitted' | 'error';

export interface AdmissionState {
  phase: AdmissionPhase;
  position: number;
  estimatedWaitMs: number;
}

/**
 * AdmissionService
 *
 * Manages the concurrent-user queue lifecycle via the login endpoint:
 *   1. POST /authn/login — if 429, extract queue token and start polling
 *   2. Poll POST /authn/login with {queueToken} every pollIntervalMs while queued
 *   3. Once login succeeds (200 + accountId), invoke openFn
 *   4. On pagehide/idle-disconnect, stops polling
 *
 * When the concurrency flag is OFF this service is never called.
 */
@Injectable({
  providedIn: 'root'
})
export class AdmissionService implements OnDestroy {
  private stateSubject = new BehaviorSubject<AdmissionState>({
    phase: 'idle',
    position: 0,
    estimatedWaitMs: 0
  });
  readonly admissionState$: Observable<AdmissionState> = this.stateSubject.asObservable();

  private stopPolling$ = new Subject<void>();
  private destroy$ = new Subject<void>();
  private hasSlot = false;
  private queueToken: number | null = null;

  constructor(private authApiService: AuthApiService) {}

  /**
   * Attempt login. On 429 (queued), start polling with the queue token.
   * On success, invoke openFn. On other errors, fail open; if even the
   * fail-open retry fails, invoke onError so the caller can stop showing the
   * "Authenticating..." loader and degrade gracefully.
   */
  gateThenOpen(loginPayload: Record<string, unknown>, openFn: (authData: AuthData) => void,
      onError?: () => void): void {
    this.setState({ phase: 'requesting', position: 0, estimatedWaitMs: 0 });
    const payload = this.queueToken
      ? { ...loginPayload, queueToken: String(this.queueToken) }
      : loginPayload;

    this.authApiService.login(payload).subscribe({
      next: (authData) => {
        this.hasSlot = true;
        this.queueToken = null;
        this.setState({ phase: 'admitted', position: 0, estimatedWaitMs: 0 });
        openFn(authData);
      },
      error: (err: any) => {
        const httpErr = err instanceof HttpErrorResponse ? err : err?.originalError;
        const status = err?.status ?? httpErr?.status;
        const body = status === 429 ? this.parseErrorBody(httpErr ?? err) : null;
        if (body) {
          this.handleQueueResponse(body, loginPayload, openFn);
        } else {
          console.warn('[AdmissionService] failOpen, status:', status);
          this.failOpen(openFn, loginPayload, 'login failed with status ' + status, onError);
        }
      }
    });
  }

  /** Stop polling. Safe to call from idle-disconnect or pagehide. */
  leave(): void {
    this.stopPolling();
    this.hasSlot = false;
    this.queueToken = null;
  }

  /** Reset to idle (e.g. after reconnect re-enters the flow) */
  reset(): void {
    this.stopPolling();
    this.hasSlot = false;
    this.queueToken = null;
    this.setState({ phase: 'idle', position: 0, estimatedWaitMs: 0 });
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // -------------------------------------------------------------------------

  private handleQueueResponse(
    res: QueuedLoginResponse,
    loginPayload: Record<string, unknown>,
    openFn: (authData: AuthData) => void
  ): void {
    this.queueToken = res.queueToken;
    const newState = {
      phase: 'queued' as AdmissionPhase,
      position: res.queuePosition,
      estimatedWaitMs: res.estimatedWaitMs
    };
    this.setState(newState);
    this.startPolling(
      res.pollIntervalMs || ConcurrencyConfigService.QUEUE_POLL_INTERVAL_MS,
      loginPayload,
      openFn
    );
  }

  private startPolling(
    intervalMs: number,
    loginPayload: Record<string, unknown>,
    openFn: (authData: AuthData) => void
  ): void {
    this.stopPolling();
    timer(intervalMs, intervalMs).pipe(
      switchMap(() => {
        const payload = this.queueToken
          ? { ...loginPayload, queueToken: String(this.queueToken) }
          : loginPayload;
        return this.authApiService.login(payload).pipe(
          catchError((err: any) => {
            const httpErr = err instanceof HttpErrorResponse ? err : err?.originalError;
            const status = err?.status ?? httpErr?.status;
            const body = status === 429 ? this.parseErrorBody(httpErr ?? err) : null;
            if (body) {
              this.queueToken = body.queueToken;
              const prev = this.stateSubject.value.estimatedWaitMs;
              this.setState({
                phase: 'queued',
                position: body.queuePosition,
                estimatedWaitMs: prev > 0 ? Math.min(body.estimatedWaitMs, prev) : body.estimatedWaitMs
              });
            }
            return of(null);
          })
        );
      }),
      takeUntil(this.stopPolling$),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (authData) => {
        if (authData?.accountId) {
          this.stopPolling();
          this.hasSlot = true;
          this.queueToken = null;
          this.setState({ phase: 'admitted', position: 0, estimatedWaitMs: 0 });
          openFn(authData);
        }
      }
    });
  }

  private stopPolling(): void {
    this.stopPolling$.next();
  }

  private parseErrorBody(err: any): QueuedLoginResponse | null {
    if (!err) return null;
    let raw = err.error ?? err;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        return null;
      }
    }
    if (raw && typeof raw === 'object' && raw.code === 1001) {
      return raw as QueuedLoginResponse;
    }
    return null;
  }

  private setState(state: AdmissionState): void {
    this.stateSubject.next(state);
  }

  private failOpen(
    openFn: (authData: AuthData) => void,
    loginPayload: Record<string, unknown>,
    reason: string,
    onError?: () => void
  ): void {
    console.warn(`[AdmissionService] Failing open: ${reason}`);
    this.setState({ phase: 'admitted', position: 0, estimatedWaitMs: 0 });
    this.hasSlot = true;
    // Retry login without queue logic — fail-open means we let the user through
    this.authApiService.login(loginPayload).subscribe({
      next: (authData) => openFn(authData),
      error: () => {
        this.setState({ phase: 'error', position: 0, estimatedWaitMs: 0 });
        onError?.();
      }
    });
  }
}
