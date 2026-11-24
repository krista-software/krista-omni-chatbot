import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AppFacade } from './core/facades';
import { WebSocketHandlerService } from './services/websocket-handler.service';
import { AdmissionState } from './services/admission.service';
import { IdleState } from './services/idle-activity.service';
import './web-components/krista-button.element';
import './web-components/krista-field.element';
import './web-components/krista-link.element';

// Import from UI Toolkit (will be replaced by library in future)
import { KSDKMessage } from '../ui-toolkit-src-angular';

/**
 * AppComponent - Root Application Component
 *
 * Refactored to use AppFacade, reducing dependencies from 17 to 1.
 * This component is now a thin UI layer that delegates all business logic
 * to the AppFacade.
 *
 * SOLID Principles Applied:
 * - Single Responsibility: Only handles view rendering and lifecycle
 * - Dependency Inversion: Depends on AppFacade abstraction
 */
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  standalone: false
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'omni-angular';
  messages: KSDKMessage[] = [];
  isLoading = false;
  topicId: string = '';
  unreadMessageId: string = '';
  hideHeader = false;
  hideSendMessage = false;

  // Concurrency feature state. These observables are inert when the feature is
  // OFF (admission phase stays 'idle', idle phase stays 'active'), so the screens
  // below never render — no separate flag gate is needed (and reading the flag
  // synchronously here would be wrong, since config loads asynchronously).
  admissionState: AdmissionState = { phase: 'idle', position: 0, estimatedWaitMs: 0 };
  idleState: IdleState = { phase: 'active', warningCountdownSeconds: 0 };

  /** True when the chat could not be started at all (login/session boot failure). */
  isBootFailed = false;

  private destroy$ = new Subject<void>();

  constructor(
    private appFacade: AppFacade,
    private webSocketHandler: WebSocketHandlerService
  ) {}

  ngOnInit(): void {
    // Initialize the application via AppFacade
    this.appFacade.initialize();

    // Subscribe to state from AppFacade
    this.appFacade.messages$
      .pipe(takeUntil(this.destroy$))
      .subscribe(messages => {
        this.messages = messages;
      });

    this.appFacade.isLoading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isLoading => {
        this.isLoading = isLoading;
      });

    this.appFacade.sessionId$
      .pipe(takeUntil(this.destroy$))
      .subscribe(sessionId => {
        this.topicId = sessionId || '';
        // Give the WS handler the live session id so the synthetic session-timeout
        // message it injects on a 1008 close carries the correct inbox/session id.
        if (sessionId) {
          this.webSocketHandler.setSessionId(sessionId);
        }
      });

    this.appFacade.hideHeader$
      .pipe(takeUntil(this.destroy$))
      .subscribe(hideHeader => {
        this.hideHeader = hideHeader;
      });

    this.appFacade.hideSendMessage$
      .pipe(takeUntil(this.destroy$))
      .subscribe(hideSendMessage => {
        this.hideSendMessage = hideSendMessage;
      });

    this.appFacade.bootFailed$
      .pipe(takeUntil(this.destroy$))
      .subscribe(bootFailed => {
        this.isBootFailed = bootFailed;
      });

    // Always subscribe — these states are inert when the feature is OFF (the
    // facade never starts admission/idle), so the screens never render. This
    // avoids depending on a flag read synchronously before config has loaded.
    this.appFacade.admissionState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.admissionState = state;
      });

    this.appFacade.idleState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.idleState = state;
      });
  }

  /**
   * Handle sidebar click events
   */
  onSidebarClick(event: Event): void {
    this.appFacade.onSidebarClick(event);
  }

  /** Called by IdleWarningModalComponent "I'm still here" button */
  onIdleStillHere(): void {
    this.appFacade.onIdleStillHere();
  }

  /** Called by InactivityDisconnectedComponent reconnect button */
  onReconnectAfterInactivity(): void {
    this.appFacade.reconnectAfterInactivity();
  }

  /** Called by InactivityDisconnectedComponent close button */
  onCloseChatWindow(): void {
    this.appFacade.closeChatWindow();
  }

  /** Called by BootFailedComponent "Try Again" button */
  onRetryBoot(): void {
    this.appFacade.retryBoot();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.appFacade.destroy();
  }

  // ---- Template helpers (pure, no side effects) ----

  get isQueued(): boolean {
    return this.admissionState.phase === 'queued';
  }

  get isDisconnectedDueToInactivity(): boolean {
    return this.idleState.phase === 'disconnected';
  }

  get showIdleWarning(): boolean {
    return this.idleState.phase === 'warning';
  }

  /**
   * Show the normal chat UI whenever the user is not queued and the boot
   * succeeded. While inactivity-disconnected the chat stays mounted (dimmed)
   * behind the modal, matching the design — there is a real conversation to show.
   *
   * <p>A failed boot is different: no session was ever established, so the pane
   * behind the notice is an empty transcript with a dead input box, and its
   * loading overlay keeps animating dots as if work were still in progress —
   * contradicting the "Chat Unavailable" message. Hidden entirely instead.
   */
  get showChatUI(): boolean {
    return this.admissionState.phase !== 'queued' && !this.isBootFailed;
  }
}
