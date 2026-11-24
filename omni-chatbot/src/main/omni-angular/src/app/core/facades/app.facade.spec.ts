import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { AppFacade } from './app.facade';
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
import { AuthData } from '../../models/api.model';

/**
 * Focused on the correctness guarantee added for KR-20928: when host attributes
 * (e.g. ACCOUNT_ID) are present, the WebSocket — which the server uses to
 * auto-trigger the welcome conversation that READS those attributes — must only
 * open AFTER the upsert API response. No attributes => no delay.
 */
describe('AppFacade — person-attributes gating of WebSocket/welcome', () => {
  let facade: AppFacade;
  let attributesDelivered$: Subject<Record<string, unknown>>;
  let personAttributesService: jasmine.SpyObj<PersonAttributesService>;
  let clientApiService: jasmine.SpyObj<ClientApiService>;

  const authData: AuthData = {
    accountId: 'acc-1',
    name: 'Guest',
    clientSessionId: 'sess-1',
    extras: { newSession: false }
  };

  beforeEach(() => {
    attributesDelivered$ = new Subject<Record<string, unknown>>();

    const queryParamsManager = jasmine.createSpyObj<QueryParamsManagerService>(
      'QueryParamsManagerService',
      ['initialize', 'getCombinedAttributes'],
      { attributesDelivered$: attributesDelivered$.asObservable() }
    );
    personAttributesService = jasmine.createSpyObj<PersonAttributesService>(
      'PersonAttributesService', ['upsertPersonAttributes']);
    clientApiService = jasmine.createSpyObj<ClientApiService>(
      'ClientApiService', ['init', 'openWebSocketConnection']);
    const notificationService = jasmine.createSpyObj<NotificationService>('NotificationService', ['init']);

    const chatFacade = jasmine.createSpyObj<ChatFacade>(
      'ChatFacade',
      ['setUserData', 'setSessionId', 'loadMessageHistory', 'markAwaitingWelcomeFirstMessage', 'sendMessage'],
      { messages$: of([]), isLoading$: of(false), sessionId$: of('') }
    );

    const configService = jasmine.createSpyObj<ConfigService>(
      'ConfigService', ['initializeConfig', 'updateConfig', 'getConfig', 'getCurrentConfig', 'refresh']);
    // canChangeLanguage:false makes loadSupportedLanguages() return early (no API).
    configService.getCurrentConfig.and.returnValue({ config: { canChangeLanguage: false } } as any);
    configService.getConfig.and.returnValue(of({ config: {} } as any));

    const sessionService = jasmine.createSpyObj<SessionService>('SessionService', ['createSession']);
    sessionService.createSession.and.returnValue(of({ inboxId: 'inbox-x' } as any));
    const userService = jasmine.createSpyObj<UserService>('UserService', ['initializeUser']);
    const authApiService = jasmine.createSpyObj<AuthApiService>('AuthApiService', ['login', 'logout']);
    const configApiService = jasmine.createSpyObj<ConfigApiService>('ConfigApiService', ['getConfiguration', 'getSupportedLanguages']);
    const loadingService = jasmine.createSpyObj<LoadingService>('LoadingService', ['setConfigLoading', 'setAuthLoading', 'setSessionLoading']);
    // Must cover EVERY StorageService method AppFacade calls. storeAuthenticationData()
    // is wrapped in try/catch, so a missing spy method does not fail the spec — it is
    // silently swallowed and only shows up as a console TypeError, leaving that path
    // effectively untested.
    const storageService = jasmine.createSpyObj<StorageService>('StorageService',
      ['setMyContactId', 'setClientSessionId', 'setName', 'getClientSessionId',
        'clearClientSessionId', 'setLoggedInDetails', 'getLoggedInDetails']);
    const themeService = jasmine.createSpyObj<ThemeService>('ThemeService', ['applyThemeWithFont']);
    const headerService = jasmine.createSpyObj<HeaderService>('HeaderService', ['setLanguages']);
    const translationService = jasmine.createSpyObj<TranslationService>('TranslationService', ['instant', 'getCurrentLanguage']);
    translationService.getCurrentLanguage.and.returnValue('en');
    translationService.instant.and.returnValue('');

    TestBed.configureTestingModule({
      providers: [
        AppFacade,
        { provide: ChatFacade, useValue: chatFacade },
        { provide: ConfigService, useValue: configService },
        { provide: SessionService, useValue: sessionService },
        { provide: UserService, useValue: userService },
        { provide: AuthApiService, useValue: authApiService },
        { provide: ConfigApiService, useValue: configApiService },
        { provide: ClientApiService, useValue: clientApiService },
        { provide: NotificationService, useValue: notificationService },
        { provide: LoadingService, useValue: loadingService },
        { provide: StorageService, useValue: storageService },
        { provide: ThemeService, useValue: themeService },
        { provide: HeaderService, useValue: headerService },
        { provide: TranslationService, useValue: translationService },
        { provide: PersonAttributesService, useValue: personAttributesService },
        { provide: QueryParamsManagerService, useValue: queryParamsManager }
      ]
    });
    facade = TestBed.inject(AppFacade);
  });

  /** Drives the auth path straight into the person-attributes / WebSocket gate. */
  function authenticate(): void {
    (facade as any).handleAuthenticationSuccess(authData);
  }

  it('waits for the upsert RESPONSE before opening the WebSocket when attributes are delivered', () => {
    const upsert$ = new Subject<any>();
    personAttributesService.upsertPersonAttributes.and.returnValue(upsert$.asObservable());

    authenticate();
    attributesDelivered$.next({ ACCOUNT_ID: '001' });

    // Upsert fired with the delivered attributes; WS NOT opened yet.
    expect(personAttributesService.upsertPersonAttributes).toHaveBeenCalledTimes(1);
    expect(personAttributesService.upsertPersonAttributes)
      .toHaveBeenCalledWith(jasmine.objectContaining({ ACCOUNT_ID: '001' }));
    expect(clientApiService.openWebSocketConnection).not.toHaveBeenCalled();

    // Response arrives → WS opens (welcome conversation can now run with attrs).
    upsert$.next({ success: true });
    expect(clientApiService.openWebSocketConnection).toHaveBeenCalledTimes(1);
  });

  it('opens the WebSocket immediately and skips the upsert when delivered attributes are empty', () => {
    personAttributesService.upsertPersonAttributes.and.returnValue(of({} as any));

    authenticate();
    attributesDelivered$.next({}); // host delivered nothing

    expect(personAttributesService.upsertPersonAttributes).not.toHaveBeenCalled();
    expect(clientApiService.openWebSocketConnection).toHaveBeenCalledTimes(1);
  });

  it('opens the WebSocket after the safety timeout when the host never delivers attributes', fakeAsync(() => {
    personAttributesService.upsertPersonAttributes.and.returnValue(of({} as any));

    authenticate();
    expect(clientApiService.openWebSocketConnection).not.toHaveBeenCalled();

    tick(2000); // PERSON_ATTRIBUTES_WAIT_MS safety cap
    expect(personAttributesService.upsertPersonAttributes).not.toHaveBeenCalled();
    expect(clientApiService.openWebSocketConnection).toHaveBeenCalledTimes(1);
  }));

  it('still opens the WebSocket even if the upsert errors (must not deadlock welcome)', () => {
    const upsert$ = new Subject<any>();
    personAttributesService.upsertPersonAttributes.and.returnValue(upsert$.asObservable());

    authenticate();
    attributesDelivered$.next({ ACCOUNT_ID: '001' });
    expect(clientApiService.openWebSocketConnection).not.toHaveBeenCalled();

    upsert$.error(new Error('upsert failed'));
    expect(clientApiService.openWebSocketConnection).toHaveBeenCalledTimes(1);
  });
});

/**
 * Tests for the centralised auth-failure handler and the service-unavailable
 * overlay notification added for KR-21024 (backend-down friendly overlay).
 *
 * <p>These drive {@code performLogin()} directly (via {@code (facade as any)}),
 * which is the primary path that calls {@code handleAuthenticationFailure()} and
 * {@code notifyHostIfServiceUnavailable()}.
 */
describe('AppFacade — auth failure + service-unavailable handling', () => {
  let facade: AppFacade;
  let loadingService: jasmine.SpyObj<LoadingService>;
  let sessionService: jasmine.SpyObj<SessionService>;
  let authApiService: jasmine.SpyObj<AuthApiService>;
  let configApiService: jasmine.SpyObj<ConfigApiService>;
  let postMessageSpy: jasmine.Spy;

  beforeEach(() => {
    postMessageSpy = spyOn(window.parent, 'postMessage');

    authApiService = jasmine.createSpyObj<AuthApiService>('AuthApiService', ['login', 'logout']);
    loadingService = jasmine.createSpyObj<LoadingService>('LoadingService',
      ['setConfigLoading', 'setAuthLoading', 'setSessionLoading', 'setWebSocketLoading',
        'setMessageHistoryLoading', 'setInitialLoading', 'setLoading']);
    sessionService = jasmine.createSpyObj<SessionService>('SessionService', ['createSession']);
    sessionService.createSession.and.returnValue(of({ inboxId: 'inbox-x' } as any));

    const attributesDelivered$ = new Subject<Record<string, unknown>>();
    const queryParamsManager = jasmine.createSpyObj<QueryParamsManagerService>(
      'QueryParamsManagerService',
      ['initialize', 'getCombinedAttributes'],
      { attributesDelivered$: attributesDelivered$.asObservable() }
    );

    const chatFacade = jasmine.createSpyObj<ChatFacade>(
      'ChatFacade',
      ['setUserData', 'setSessionId', 'loadMessageHistory',
        'markAwaitingWelcomeFirstMessage', 'sendMessage'],
      { messages$: of([]), isLoading$: of(false), sessionId$: of('') }
    );
    const configService = jasmine.createSpyObj<ConfigService>(
      'ConfigService', ['initializeConfig', 'updateConfig', 'getConfig', 'getCurrentConfig', 'refresh']);
    configService.getCurrentConfig.and.returnValue({ config: { canChangeLanguage: false } } as any);
    configService.getConfig.and.returnValue(of({ config: {} } as any));

    configApiService = jasmine.createSpyObj<ConfigApiService>('ConfigApiService',
      ['getConfiguration', 'getSupportedLanguages']);
    const personAttributesService = jasmine.createSpyObj<PersonAttributesService>(
      'PersonAttributesService', ['upsertPersonAttributes']);
    const clientApiService = jasmine.createSpyObj<ClientApiService>(
      'ClientApiService', ['init', 'openWebSocketConnection']);
    const notificationService = jasmine.createSpyObj<NotificationService>('NotificationService', ['init']);
    const userService = jasmine.createSpyObj<UserService>('UserService', ['initializeUser']);
    // See the note on the other StorageService spy: every method AppFacade calls must be
    // stubbed, otherwise storeAuthenticationData()'s try/catch hides the failure.
    const storageService = jasmine.createSpyObj<StorageService>('StorageService',
      ['setMyContactId', 'setClientSessionId', 'setName', 'getClientSessionId',
        'clearClientSessionId', 'setLoggedInDetails', 'getLoggedInDetails']);
    const themeService = jasmine.createSpyObj<ThemeService>('ThemeService', ['applyThemeWithFont']);
    const headerService = jasmine.createSpyObj<HeaderService>('HeaderService', ['setLanguages']);
    const translationService = jasmine.createSpyObj<TranslationService>('TranslationService',
      ['instant', 'getCurrentLanguage']);
    translationService.getCurrentLanguage.and.returnValue('en');
    translationService.instant.and.returnValue('');

    TestBed.configureTestingModule({
      providers: [
        AppFacade,
        { provide: ChatFacade, useValue: chatFacade },
        { provide: ConfigService, useValue: configService },
        { provide: SessionService, useValue: sessionService },
        { provide: UserService, useValue: userService },
        { provide: AuthApiService, useValue: authApiService },
        { provide: ConfigApiService, useValue: configApiService },
        { provide: ClientApiService, useValue: clientApiService },
        { provide: NotificationService, useValue: notificationService },
        { provide: LoadingService, useValue: loadingService },
        { provide: StorageService, useValue: storageService },
        { provide: ThemeService, useValue: themeService },
        { provide: HeaderService, useValue: headerService },
        { provide: TranslationService, useValue: translationService },
        { provide: PersonAttributesService, useValue: personAttributesService },
        { provide: QueryParamsManagerService, useValue: queryParamsManager }
      ]
    });
    facade = TestBed.inject(AppFacade);
  });

  // -----------------------------------------------------------------------
  // handleAuthenticationFailure — called on non-service-unavailable errors
  // -----------------------------------------------------------------------

  it('non-service-unavailable login error: clears auth loading', () => {
    authApiService.login.and.returnValue(throwError(() => ({ status: 401 })));
    (facade as any).performLogin();
    expect(loadingService.setAuthLoading).toHaveBeenCalledWith(false);
  });

  // The session fallback is only worthwhile when a stored session exists — see
  // handleAuthenticationFailure. Without one, createSession would fail exactly as
  // login just did, re-arm the loading spinner and leave a blank pane.

  it('login error WITH a stored session: falls back to session creation', () => {
    const storage = TestBed.inject(StorageService) as jasmine.SpyObj<StorageService>;
    storage.getClientSessionId.and.returnValue('sess-1');
    authApiService.login.and.returnValue(throwError(() => ({ status: 401 })));

    (facade as any).performLogin();

    expect(sessionService.createSession).toHaveBeenCalled();
  });

  it('login error with NO stored session: skips session creation', () => {
    const storage = TestBed.inject(StorageService) as jasmine.SpyObj<StorageService>;
    storage.getClientSessionId.and.returnValue(null);
    authApiService.login.and.returnValue(throwError(() => ({ status: 401 })));

    (facade as any).performLogin();

    expect(sessionService.createSession).not.toHaveBeenCalled();
  });

  it('login error with NO stored session: surfaces the boot failure', (done) => {
    const storage = TestBed.inject(StorageService) as jasmine.SpyObj<StorageService>;
    storage.getClientSessionId.and.returnValue(null);
    authApiService.login.and.returnValue(throwError(() => ({ status: 500 })));

    (facade as any).performLogin();

    facade.bootFailed$.subscribe(failed => {
      expect(failed).toBeTrue();
      done();
    });
  });

  it('login error with NO stored session: clears every loader so nothing spins', () => {
    const storage = TestBed.inject(StorageService) as jasmine.SpyObj<StorageService>;
    storage.getClientSessionId.and.returnValue(null);
    authApiService.login.and.returnValue(throwError(() => ({ status: 500 })));

    (facade as any).performLogin();

    expect(loadingService.setAuthLoading).toHaveBeenCalledWith(false);
    expect(loadingService.setSessionLoading).toHaveBeenCalledWith(false);
    expect(loadingService.setConfigLoading).toHaveBeenCalledWith(false);
    // Not just the boot trio — any loader left set keeps an indicator animating
    // behind the failure notice, reading as "still working".
    expect(loadingService.setWebSocketLoading).toHaveBeenCalledWith(false);
    expect(loadingService.setMessageHistoryLoading).toHaveBeenCalledWith(false);
    expect(loadingService.setInitialLoading).toHaveBeenCalledWith(false);
    expect(loadingService.setLoading).toHaveBeenCalledWith(false);
  });

  it('null accountId with a stored session: falls back to session creation', () => {
    const storage = TestBed.inject(StorageService) as jasmine.SpyObj<StorageService>;
    storage.getClientSessionId.and.returnValue('sess-1');
    authApiService.login.and.returnValue(of({} as any));

    (facade as any).performLogin();

    expect(sessionService.createSession).toHaveBeenCalled();
  });

  it('session creation failure: surfaces the boot failure', (done) => {
    const storage = TestBed.inject(StorageService) as jasmine.SpyObj<StorageService>;
    storage.getClientSessionId.and.returnValue('sess-1');
    authApiService.login.and.returnValue(throwError(() => ({ status: 401 })));
    sessionService.createSession.and.returnValue(throwError(() => ({ status: 500 })));

    (facade as any).performLogin();

    facade.bootFailed$.subscribe(failed => {
      expect(failed).toBeTrue();
      done();
    });
  });

  it('service-unavailable session failure: defers to the host overlay, no in-app notice', () => {
    const storage = TestBed.inject(StorageService) as jasmine.SpyObj<StorageService>;
    storage.getClientSessionId.and.returnValue('sess-1');
    authApiService.login.and.returnValue(throwError(() => ({ status: 401 })));
    sessionService.createSession.and.returnValue(throwError(() => ({ status: 503 })));

    (facade as any).performLogin();

    expect(postMessageSpy).toHaveBeenCalledWith(
      jasmine.stringContaining('serviceUnavailable'), '*');
    let failed = true;
    facade.bootFailed$.subscribe(v => failed = v);
    expect(failed).toBeFalse();
  });

  // -----------------------------------------------------------------------
  // Pooled-login (Faster Startup) session-inbox fast path: when the login
  // response already carries the real session inbox (inbox_S_…) and
  // extras.sessionReady, the SPA must use THAT inbox and SKIP POST /session;
  // otherwise it falls back to createSession. Guards the one-call change.
  // -----------------------------------------------------------------------

  it('pooled login (extras.sessionReady): uses the login inbox and does NOT call createSession', () => {
    const chatFacade = TestBed.inject(ChatFacade) as jasmine.SpyObj<ChatFacade>;
    (facade as any).handleAuthenticationSuccess({
      accountId: 'acc-1', name: 'Guest', clientSessionId: 'sess-1',
      inboxId: 'inbox_S_pooled', extras: { newSession: true, sessionReady: true }
    } as AuthData);
    expect(sessionService.createSession).not.toHaveBeenCalled();
    expect(chatFacade.setSessionId).toHaveBeenCalledWith('inbox_S_pooled');
  });

  it('login WITHOUT sessionReady: falls back to createSession and uses its inbox', () => {
    const chatFacade = TestBed.inject(ChatFacade) as jasmine.SpyObj<ChatFacade>;
    (facade as any).handleAuthenticationSuccess({
      accountId: 'acc-1', name: 'Guest', clientSessionId: 'sess-1',
      inboxId: 'inbox_wsContact_acc1', extras: { newSession: true }
    } as AuthData);
    expect(sessionService.createSession).toHaveBeenCalled();
    expect(chatFacade.setSessionId).toHaveBeenCalledWith('inbox-x');
  });

  // -----------------------------------------------------------------------
  // notifyHostIfServiceUnavailable — status 0/502/503/504
  // -----------------------------------------------------------------------

  it('login error status 502: notifies host via postMessage', () => {
    authApiService.login.and.returnValue(throwError(() => ({ status: 502 })));
    (facade as any).performLogin();
    expect(postMessageSpy).toHaveBeenCalledWith(
      jasmine.stringContaining('serviceUnavailable'), '*');
  });

  it('login error status 502: does NOT call initializeSessionAndMessages (no createSession)', () => {
    authApiService.login.and.returnValue(throwError(() => ({ status: 502 })));
    (facade as any).performLogin();
    expect(sessionService.createSession).not.toHaveBeenCalled();
  });

  it('login error status 0 (network error): notifies host', () => {
    authApiService.login.and.returnValue(throwError(() => ({ status: 0 })));
    (facade as any).performLogin();
    expect(postMessageSpy).toHaveBeenCalledWith(
      jasmine.stringContaining('serviceUnavailable'), '*');
  });

  it('login error status 503: notifies host', () => {
    authApiService.login.and.returnValue(throwError(() => ({ status: 503 })));
    (facade as any).performLogin();
    expect(postMessageSpy).toHaveBeenCalledWith(
      jasmine.stringContaining('serviceUnavailable'), '*');
  });

  it('login error status 403: does NOT notify host (auth failure, not server down)', () => {
    authApiService.login.and.returnValue(throwError(() => ({ status: 403 })));
    (facade as any).performLogin();
    expect(postMessageSpy).not.toHaveBeenCalled();
  });
});
