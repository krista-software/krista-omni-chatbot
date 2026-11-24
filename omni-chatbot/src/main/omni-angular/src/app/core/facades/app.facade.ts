import { Injectable } from '@angular/core';
import { Observable, Subject, BehaviorSubject, of } from 'rxjs';
import { take, switchMap, tap, catchError, map, takeUntil, shareReplay, timeout } from 'rxjs/operators';
import { ChatFacade } from './chat.facade';
import { ConfigService } from '../../services/config.service';
import { SessionService } from '../../services/session.service';
import { UserService } from '../../services/user.service';
import { AuthApiService } from '../../services/auth-api.service';
import { ConfigApiService } from '../../services/config-api.service';
import { ClientApiService } from '../../services/client-api.service';
import { NotificationService } from '../../services/notification.service';
import { LoadingService } from '../../services/loading.service';
import { StorageService } from '../../services/storage.service';
import { ThemeService } from '../../services/theme.service';
import { HeaderService } from '../../services/header.service';
import { TranslationService } from '../../services/translation.service';
import { PersonAttributesService } from '../../services/person-attributes.service';
import { QueryParamsManagerService } from '../../services/core/query-params-manager.service';
import { ConcurrencyConfigService } from '../../services/concurrency-config.service';
import { AdmissionService, AdmissionState } from '../../services/admission.service';
import { IdleActivityService, IdleState } from '../../services/idle-activity.service';
import { KSDKMessage, ToolkitConfig } from '../../../ui-toolkit-src-angular';
import { ChatbotConfig } from '../../models/config.model';
import { InternalChatbotConfig } from '../../models/chatbot.models';
import { AuthData, LanguageOption } from '../../models/api.model';
import { POST_MESSAGE_TYPES } from '../../config/constants';

/**
 * App Facade Service
 *
 * Provides a simplified interface for application initialization and lifecycle.
 * Follows Facade Pattern to reduce AppComponent's dependencies from 17 to 3-4.
 *
 * Responsibilities:
 * - Application initialization (config, auth, session, WebSocket)
 * - Configuration and theme management
 * - Event handling (krista-button, postMessage)
 * - Exposes state observables for the view
 *
 * SOLID Principles Applied:
 * - Single Responsibility: Only handles app-level orchestration
 * - Dependency Inversion: Components depend on this facade, not individual services
 * - Open/Closed: New initialization steps can be added without modifying components
 *
 * Boot flow — flag OFF:
 *   config → login → session → attrs → WS
 *
 * Boot flow — flag ON:
 *   config → login (429? queue + poll; 200? admitted) → session → attrs → WS
 *   Admission is gated at the login endpoint itself (HTTP 429 when full).
 */
@Injectable({
  providedIn: 'root'
})
export class AppFacade {
  // Expose state for the view
  readonly messages$: Observable<KSDKMessage[]>;
  readonly isLoading$: Observable<boolean>;
  readonly sessionId$: Observable<string>;

  // Layout state
  private hideHeaderSubject = new BehaviorSubject<boolean>(false);
  private hideSendMessageSubject = new BehaviorSubject<boolean>(false);
  readonly hideHeader$ = this.hideHeaderSubject.asObservable();
  readonly hideSendMessage$ = this.hideSendMessageSubject.asObservable();

  // Concurrency feature state — only populated when flag is ON
  readonly admissionState$: Observable<AdmissionState>;
  readonly idleState$: Observable<IdleState>;

  // Terminal boot failure: the chat could not be started at all (login failed with
  // no reusable stored session, or session creation failed). Surfaces an in-app
  // notice with Retry instead of leaving the user on a blank pane with a spinner.
  // NOT used for the server-unreachable case — that is owned by the host overlay
  // via notifyHostIfServiceUnavailable(), and showing both would double up.
  private bootFailedSubject = new BehaviorSubject<boolean>(false);
  readonly bootFailed$ = this.bootFailedSubject.asObservable();

  // Internal state
  private webSocketInitialized = false;
  private isAuthenticated = false;
  private userData: AuthData | null = null;
  private destroy$ = new Subject<void>();

  // Resolves once person attributes are persisted (or determined absent). Built
  // at handleAuthenticationSuccess and awaited before opening the WebSocket,
  // because the server auto-triggers the welcome conversation on WS open and
  // that conversation reads the upserted account attributes.
  private attributesSettled$: Observable<void> | null = null;

  // Host attributes (e.g. ACCOUNT_ID passed on the launcher.js URL) reach the
  // SPA via the host -> iframe postMessage handshake. Cap how long we wait for
  // that delivery before proceeding without it, so a non-standard embedding
  // that never postMessages can't deadlock the chat. Standard embeddings
  // deliver in ~tens of ms, so this cap is only a safety net.
  private static readonly PERSON_ATTRIBUTES_WAIT_MS = 2000;

  constructor(
    private chatFacade: ChatFacade,
    private configService: ConfigService,
    private sessionService: SessionService,
    private userService: UserService,
    private authApiService: AuthApiService,
    private configApiService: ConfigApiService,
    private clientApiService: ClientApiService,
    private notificationService: NotificationService,
    private loadingService: LoadingService,
    private storageService: StorageService,
    private themeService: ThemeService,
    private headerService: HeaderService,
    private translationService: TranslationService,
    private personAttributesService: PersonAttributesService,
    private queryParamsManager: QueryParamsManagerService,
    private concurrencyConfig: ConcurrencyConfigService,
    private admissionService: AdmissionService,
    private idleActivityService: IdleActivityService
  ) {
    // Delegate state observables to ChatFacade
    this.messages$ = this.chatFacade.messages$;
    this.isLoading$ = this.chatFacade.isLoading$;
    this.sessionId$ = this.chatFacade.sessionId$;
    // Concurrency observables are always wired; AppComponent only renders them
    // when concurrencyConfig.isEnabled() is true (guarded in template).
    this.admissionState$ = this.admissionService.admissionState$;
    this.idleState$ = this.idleActivityService.idleState$;
  }

  /**
   * Initialize the application
   * Call this from AppComponent.ngOnInit()
   */
  initialize(): void {
    // Initialize query params manager
    this.queryParamsManager.initialize();

    // Initialize services
    this.initializeServices();

    // Initialize APIs (boot flow branches on isEnabled())
    this.initializeAPIs();

    // Set up event listeners
    this.setupEventListeners();

    // Subscribe to config changes for layout
    this.subscribeToConfigChanges();
  }

  /**
   * Clean up resources
   * Call this from AppComponent.ngOnDestroy()
   */
  destroy(): void {
    this.idleActivityService.stop();
    this.admissionService.leave();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Handle sidebar click events
   */
  onSidebarClick(event: Event): void {
    // Handle sidebar click events - can be extended as needed
  }

  /**
   * Send a message
   */
  sendMessage(message: string): void {
    this.chatFacade.sendMessage(message);
  }

  /**
   * Reconnect after idle-disconnect: re-enters the entire boot sequence
   * (config → admission → auth → WS). Mirrors HeaderComponent.onClickStartOver():
   * when the SPA URL ends with '/chat', navigate to the base UI URL instead of
   * reload() — reloading '/ui/chat' makes the server look for a UI asset named
   * 'chat' ("UI asset not found"); the base '/ui/' serves index.html and Angular
   * re-routes to /chat.
   */
  reconnectAfterInactivity(): void {
    this.reloadApp();
  }

  /**
   * Re-enters the whole boot sequence. When the SPA URL ends with '/chat',
   * navigate to the base UI URL instead of reload(): reloading '/ui/chat' makes
   * the server look for a UI asset named 'chat' ("UI asset not found"), whereas
   * the base '/ui/' serves index.html and Angular re-routes to /chat.
   */
  private reloadApp(): void {
    const currentUrl = window.location.href;
    if (currentUrl.endsWith('/chat')) {
      window.location.href = currentUrl.slice(0, -4);
    } else {
      window.location.reload();
    }
  }

  /**
   * Closes (collapses) the chat widget without reconnecting — used by the
   * inactivity-disconnected screen so a user who does not want to reconnect can
   * dismiss the chat. Mirrors HeaderComponent.onCloseClick(): posts a minimize
   * message to the host launcher.
   */
  closeChatWindow(): void {
    if (window.parent) {
      window.parent.postMessage('{"messageType": "minimize", "value":true}', "*");
    }
  }

  /**
   * Called by AppComponent when the user confirms they are still here from
   * the idle warning modal.
   */
  onIdleStillHere(): void {
    this.idleActivityService.resetOnUserConfirmation();
  }

  // ============================================================================
  // Private Initialization Methods
  // ============================================================================

  private initializeServices(): void {
    this.configService.initializeConfig();
    this.initializeToolkitConfigFromStorage();
    this.userService.initializeUser();
  }

  /**
   * Core boot. Config is fetched first, then login runs — either directly
   * (flag OFF) or via AdmissionService which handles HTTP 429 queue polling
   * (flag ON). The enabled/disabled decision is made after config has been
   * applied, so it reflects the server-side concurrency setting.
   */
  private initializeAPIs(): void {
    const loadingConfigMessage = this.translationService.instant('initializerProvider.loadingConfiguration');
    const authenticatingMessage = this.translationService.instant('initializerProvider.authenticating');
    this.loadingService.setConfigLoading(true, loadingConfigMessage);
    this.loadingService.setAuthLoading(true, authenticatingMessage);

    this.configApiService.getConfiguration().pipe(
      take(1),
      tap((config: ChatbotConfig) => {
        this.handleConfigLoaded(config);
        this.loadingService.setConfigLoading(false);
      }),
      catchError((error) => {
        console.error('Failed to load config:', error);
        this.loadingService.setConfigLoading(false);
        return of(null);
      })
    ).subscribe(() => {
      this.bootLogin();
    });
  }

  private handleConfigLoaded(config: ChatbotConfig): void {
    this.configService.updateConfig(config);

    // Update ToolkitConfig with botName
    const existingToolkitConfig = ToolkitConfig.getInstance().getConfig();
    if (existingToolkitConfig?.user?.id) {
      ToolkitConfig.getInstance().setConfig({
        ...existingToolkitConfig,
        config: {
          ...existingToolkitConfig.config,
          botName: config?.config?.botName || existingToolkitConfig.config?.botName || 'Krista',
          isFullSize: config?.config?.['isFullSize'] || existingToolkitConfig.config?.isFullSize || false,
          hideSendMessage: config?.config?.['hideSendMessage'] || existingToolkitConfig.config?.hideSendMessage || false
        }
      });
    }

    // Apply theme
    if (config.config?.theme) {
      this.themeService.applyThemeWithFont(config.config.theme);
    }
  }

  /**
   * Handles restartOnRefresh, then branches: flag ON routes through
   * AdmissionService (handles 429 queue polling); flag OFF calls login directly.
   */
  private bootLogin(): void {
    this.configService.getConfig()
      .pipe(
        take(1),
        switchMap((config: InternalChatbotConfig) => {
          const shouldRestartOnRefresh = config?.config?.['restartOnRefresh'] === true;
          const hasExistingSession = !!this.storageService.getClientSessionId();
          if (shouldRestartOnRefresh && hasExistingSession) {
            return this.authApiService.logout().pipe(
              tap(() => this.storageService.clearClientSessionId()),
              catchError(() => {
                this.storageService.clearClientSessionId();
                return of(null);
              }),
              map(() => config)
            );
          }
          return of(config);
        })
      )
      .subscribe(() => {
        if (this.concurrencyConfig.isEnabled()) {
          this.admissionService.gateThenOpen(
            {},
            (authData) => this.handleAuthenticationSuccess(authData),
            () => this.handleAuthenticationFailure()
          );
        } else {
          this.performLogin();
        }
      });
  }

  private performLogin(): void {
    this.authApiService.login({}).subscribe({
      next: (authData: AuthData) => {
        if (authData?.accountId) {
          this.handleAuthenticationSuccess(authData);
        } else {
          this.handleAuthenticationFailure();
        }
      },
      error: (error) => {
        if (this.notifyHostIfServiceUnavailable(error)) {
          // Server unreachable: the session fallback below would just hit the
          // same dead server. The host overlay owns recovery — Try Again
          // reloads the app for a full fresh boot (login + session).
          this.loadingService.setAuthLoading(false);
          return;
        }
        // Other failures (4xx etc.): fall back to the session boot — an
        // existing stored session may still be valid (pre-existing behavior).
        this.handleAuthenticationFailure();
      }
    });
  }

  /**
   * Terminal login failure (both boot paths): clear the "Authenticating..."
   * loader, then either degrade into session creation or surface the failure.
   * In the concurrency (flag ON) path this is invoked via AdmissionService's
   * onError when even the fail-open retry fails.
   *
   * <p>The session fallback only makes sense when a stored client session id
   * exists — an already-established session may still be valid. On a fresh boot
   * there is nothing to fall back to, so createSession would fail exactly like
   * login just did: a guaranteed-useless second request that re-arms the loading
   * spinner (SessionService sets session loading) before failing silently and
   * leaving a blank pane. Surface the failure instead.
   */
  private handleAuthenticationFailure(): void {
    this.loadingService.setAuthLoading(false);
    if (!this.storageService.getClientSessionId()) {
      this.failBoot();
      return;
    }
    this.initializeSessionAndMessages();
  }

  /**
   * Marks the boot as failed: clears every loader so nothing keeps spinning and
   * flips the in-app failure notice on.
   */
  private failBoot(): void {
    // Every loader, not just the boot trio: any one left set keeps an indicator
    // animating behind the failure notice, which reads as "still working" while
    // the notice says the opposite.
    this.loadingService.setAuthLoading(false);
    this.loadingService.setSessionLoading(false);
    this.loadingService.setConfigLoading(false);
    this.loadingService.setWebSocketLoading(false);
    this.loadingService.setMessageHistoryLoading(false);
    this.loadingService.setInitialLoading(false);
    this.loadingService.setLoading(false);
    this.isAuthenticated = false;
    this.userData = null;
    this.bootFailedSubject.next(true);
  }

  /**
   * Retry after a failed boot. Reloads the app for a clean run through the whole
   * sequence (config -> admission -> login -> session -> WebSocket); retrying the
   * individual failed call would leave partially-initialised state behind.
   */
  retryBoot(): void {
    this.reloadApp();
  }

  /**
   * When a boot-critical API fails because the SERVER is unreachable
   * (status 0 = network error, 502/503/504 = gateway/unavailable), tell the
   * host launcher so it can cover the broken chat with the friendly
   * "We'll be back soon" overlay. During an outage the app itself often boots
   * fine from cached static assets, so the launcher cannot detect this case
   * on its own (it cannot see a cross-origin iframe's API traffic). Other
   * statuses (401/403/...) are legitimate app-level flows and stay untouched.
   * Returns true when the host was notified (server unreachable).
   */
  private notifyHostIfServiceUnavailable(error: any): boolean {
    const status = error?.status;
    if (status === 0 || status === 502 || status === 503 || status === 504) {
      window.parent.postMessage(`{"messageType": "${POST_MESSAGE_TYPES.SERVICE_UNAVAILABLE}"}`, '*');
      return true;
    }
    return false;
  }

  private handleAuthenticationSuccess(authData: AuthData): void {
    this.storeAuthenticationData(authData);

    // Begin settling person attributes now: wait for the host to deliver them
    // (postMessage handshake), upsert when present, and complete on the API
    // response. shareReplay(1) so the eager kickoff here and the WebSocket-open
    // gate share ONE upsert. Starting it here lets the upsert overlap
    // createSession on the login-fallback path.
    this.attributesSettled$ = this.buildPersonAttributesSettled().pipe(shareReplay(1));
    this.attributesSettled$.pipe(takeUntil(this.destroy$)).subscribe();

    // Set cookie for WebSocket
    this.setCookie('chatbotSessionId', authData.clientSessionId);

    this.isAuthenticated = true;
    this.userData = authData;

    // Update chat facade with user data. Forward extras (e.g. newSession) so downstream
    // components (TimelineView) can gate features such as scroll-up pagination on a brand-new
    // session where no server-side message history exists yet.
    this.chatFacade.setUserData({
      accountId: authData.accountId,
      name: authData.name,
      extras: authData.extras
    });

    this.loadingService.setAuthLoading(false);
    this.initializeSessionAndMessages();
  }

  /**
   * Emits once (then completes) when person attributes are "settled" — i.e.
   * either persisted via the upsert API, or confirmed absent.
   *
   * Attributes (e.g. ACCOUNT_ID passed on the launcher.js URL) reach the SPA
   * via the host -> iframe postMessage handshake, which can land slightly
   * AFTER authentication. We wait for that delivery (bounded by
   * PERSON_ATTRIBUTES_WAIT_MS so a non-standard embedding that never
   * postMessages cannot deadlock the chat), then:
   *  - non-empty attributes -> fire the upsert and complete on its RESPONSE
   *    (errors swallowed so a failed upsert cannot block the welcome forever);
   *  - empty attributes -> complete immediately (no upsert, no delay).
   */
  private buildPersonAttributesSettled(): Observable<void> {
    return this.queryParamsManager.attributesDelivered$.pipe(
      take(1),
      timeout({ first: AppFacade.PERSON_ATTRIBUTES_WAIT_MS, with: () => of({} as Record<string, unknown>) }),
      switchMap(attributes => {
        if (!attributes || Object.keys(attributes).length === 0) {
          return of(void 0);
        }
        return this.personAttributesService.upsertPersonAttributes(attributes).pipe(
          map(() => void 0),
          catchError(() => of(void 0))
        );
      })
    );
  }

  /**
   * Opens the WebSocket only after person attributes are settled. The server
   * auto-triggers the welcome conversation the instant the WS connects
   * (WsConnectionOpenedHandler) and that conversation — plus every later turn
   * over the same socket — reads the account's attributes, so the upsert must
   * land first. When there are no attributes this resolves in ~tens of ms
   * (empty delivery), so no-attribute loads are not delayed.
   *
   * Admission (when enabled) has already been resolved at login time, so no
   * separate gate is needed here.
   */
  private openWebSocketWhenAttributesSettled(): void {
    (this.attributesSettled$ ?? of(void 0))
      .pipe(take(1), takeUntil(this.destroy$))
      .subscribe(() => {
        this.initializeWebSocket();
      });
  }

  private initializeSessionAndMessages(): void {
    // Load supported languages AFTER authentication is complete
    // so that X-Krista-Context header is available for the platform gateway
    this.loadSupportedLanguages();

    // Fast path — pool-served logins (Faster Startup): the login response already carries the
    // real OmniChannel session inbox (inbox_S_…) and sets extras.sessionReady, because the
    // session was pre-warmed server-side. Use it directly and SKIP POST /session — that call
    // (mediumService.getOrCreateSession, a JMS round-trip) is the session-creation bottleneck
    // under concurrent load, and it is redundant when the session already exists. Fresh and
    // returning logins carry no sessionReady flag and fall through to createSession as before.
    const pooledInboxId = this.userData?.inboxId;
    if (this.userData?.extras?.sessionReady && pooledInboxId) {
      this.applySession(pooledInboxId);
      return;
    }

    const currentLanguage = this.translationService.getCurrentLanguage();
    this.sessionService.createSession(currentLanguage).subscribe({
      next: (session) => {
        if (session.inboxId) {
          this.applySession(session.inboxId);
        } else {
          this.openWebSocketWhenAttributesSettled();
          this.loadingService.setSessionLoading(false);
        }
      },
      error: (error) => {
        this.loadingService.setSessionLoading(false);
        if (this.notifyHostIfServiceUnavailable(error)) {
          // Server unreachable: the host overlay owns recovery. Do not also show
          // the in-app notice — the user would see two competing messages.
          this.isAuthenticated = false;
          this.userData = null;
          return;
        }
        this.failBoot();
      }
    });
  }

  /**
   * Wires up a resolved session inbox — from either the pooled login response
   * (Faster Startup fast path) or createSession: sets the session id, loads prior
   * history for existing sessions or injects the configured welcome for brand-new
   * ones, then opens the WebSocket and clears the session-loading state.
   */
  private applySession(inboxId: string): void {
    this.chatFacade.setSessionId(inboxId);
    // The welcome greeting is owned by the backend (single source of truth): it pushes
    // the static Welcome Message when no Welcome Conversation is configured, or runs the
    // conversation otherwise. The client no longer injects it.
    // Only load message history for existing sessions that may have prior messages.
    // New sessions (manual refresh/restart, or pool-served) have no history, so skip
    // the "Loading conversation history" screen to avoid unnecessary delay.
    if (!this.userData?.extras?.newSession) {
      // Returning session: load prior history. The backend pushes the welcome greeting
      // over the WebSocket when the session hasn't been welcomed yet.
      this.chatFacade.loadMessageHistory(inboxId);
    } else {
      // New session: the backend pushes the welcome greeting as soon as the WS opens.
      // Show the typing indicator until it arrives so the user doesn't briefly see a
      // blank chat.
      this.chatFacade.markAwaitingWelcomeFirstMessage();
    }
    this.openWebSocketWhenAttributesSettled();
    this.loadingService.setSessionLoading(false);
  }

  /**
   * Opens the WebSocket connection. When the concurrency flag is on, the idle
   * monitor is started here (after auth data is available, so the sessionKey uses
   * the real accountId). The WS URL is identical to the pre-feature format.
   */
  private initializeWebSocket(): void {
    if (this.webSocketInitialized) return;
    this.webSocketInitialized = true;

    try {
      // NotificationService.init() delegates to the same ClientApiService singleton,
      // which registers the WS listener and opens the socket. Do NOT also call
      // clientApiService.init() here: addListener() pushes unconditionally, so a
      // second init registers the service twice and every inbound notification is
      // then dispatched twice. Covered by ws-notification-dispatch.spec.ts.
      this.notificationService.init();
      this.clientApiService.openWebSocketConnection();
      // Start idle monitor only for the enabled path, after WS is open.
      if (this.concurrencyConfig.isEnabled()) {
        const sessionKey = this.userData?.accountId
          || this.storageService.getClientSessionId()
          || 'default';
        this.idleActivityService.start(sessionKey);
      }
    } catch (error) {
      this.webSocketInitialized = false;
    }
  }

  private subscribeToConfigChanges(): void {
    this.configService.getConfig().subscribe((config: InternalChatbotConfig) => {
      this.hideHeaderSubject.next(config.config?.['isFullSize'] || false);
      this.hideSendMessageSubject.next(config.config?.hideSendMessage || false);

      if (config.config?.['theme']) {
        this.themeService.applyThemeWithFont(config.config['theme']);
      }
    });
  }

  private setupEventListeners(): void {
    document.addEventListener('krista-button-send-message', ((event: CustomEvent<{ message: string }>) => {
      const message = event.detail?.message;
      if (message) {
        this.chatFacade.sendMessage(message);
      }
    }) as EventListener);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private loadSupportedLanguages(): void {
    // Skip the API call when language switching is disabled — the header hides the
    // language picker, so the response would be unused. canChangeLanguage in the
    // current config is the resolved value (both the workspace flag and
    // isMultilingualEnabled must be true; see ConfigService).
    const currentConfig = this.configService.getCurrentConfig();
    const canChangeLanguage = currentConfig?.config?.canChangeLanguage;
    if (!canChangeLanguage) {
      return;
    }
    // Prefer the inlined supportedLanguages list from the bootstrap config
    // envelope (BE inlines it alongside isMultilingualEnabled, ConfigService
    // maps it onto InternalChatbotConfig.languages) to avoid an extra
    // GET /chatbot/supportedLanguages round-trip on every page load.
    // Fallback to the API call only when the inlined list is missing (e.g.
    // dev-mode config fallback path, or an older BE that doesn't inline yet).
    const inlinedLanguages = currentConfig?.languages;
    if (inlinedLanguages && inlinedLanguages.length > 0) {
      this.headerService.setLanguages(inlinedLanguages as LanguageOption[]);
      return;
    }
    this.configApiService.getSupportedLanguages().subscribe({
      next: (languages: LanguageOption[]) => this.headerService.setLanguages(languages),
      error: () => { /* Header will use cached languages */
      }
    });
  }

  private initializeToolkitConfigFromStorage(): void {
    try {
      const authData = this.storageService.getLoggedInDetails();
      if (authData?.accountId) {
        const currentConfig = this.configService.getCurrentConfig();
        ToolkitConfig.getInstance().setConfig({
          user: { id: authData.accountId, name: authData.name },
          kristaAccountId: authData.kristaAccountId,
          config: {
            botName: currentConfig?.config?.botName || 'Krista',
            isFullSize: currentConfig?.config?.['isFullSize'] || false,
            hideSendMessage: currentConfig?.config?.['hideSendMessage'] || false
          }
        });
      }
    } catch (error) {
      console.error('Failed to initialize ToolkitConfig from storage:', error);
    }
  }

  private storeAuthenticationData(authData: AuthData): void {
    try {
      // Spread: AuthData (interface) lacks StoredAuthData's index signature; a
      // fresh object literal satisfies it without a cast.
      this.storageService.setLoggedInDetails({ ...authData });

      if (authData.accountId) this.storageService.setMyContactId(authData.accountId);
      if (authData.clientSessionId) {
        this.storageService.setClientSessionId(authData.clientSessionId);
        // Session id now exists — re-emit config so the header rebuilds a
        // media-backed icon URL (auth'd via clientSessionId) that would have
        // 401'd during the pre-login config emit.
        this.configService.refresh();
      }
      if (authData.name) this.storageService.setName(authData.name);

      const currentConfig = this.configService.getCurrentConfig();
      ToolkitConfig.getInstance().setConfig({
        user: { id: authData.accountId, name: authData.name },
        kristaAccountId: authData.kristaAccountId,
        config: {
          botName: currentConfig?.config?.botName || 'Krista',
          isFullSize: currentConfig?.config?.['isFullSize'] || false,
          hideSendMessage: currentConfig?.config?.['hideSendMessage'] || false
        }
      });
    } catch (error) {
      console.error('Failed to store authentication data:', error);
    }
  }

  private setCookie(name: string, value: string, days: number = 7): void {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
  }
}
