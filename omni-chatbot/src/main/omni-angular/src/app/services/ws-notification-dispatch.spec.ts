import { TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { AppFacade } from '../core/facades/app.facade';
import { ChatFacade } from '../core/facades/chat.facade';
import { ConfigService } from './config.service';
import { SessionService } from './session.service';
import { UserService } from './user.service';
import { AuthApiService } from './auth-api.service';
import { ConfigApiService } from './config-api.service';
import { ClientApiService } from './client-api.service';
import { NotificationService } from './notification.service';
import { LoadingService } from './loading.service';
import { StorageService } from './storage.service';
import { ThemeService } from './theme.service';
import { HeaderService } from './header.service';
import { TranslationService } from './translation.service';
import { PersonAttributesService } from './person-attributes.service';
import { QueryParamsManagerService } from './core/query-params-manager.service';
import { WebSocketHandlerService } from './websocket-handler.service';
import { WebSocketConnectionService } from './websocket-connection.service';
import { TextTransformerService } from './text-transformer.service';
import { AuthData } from '../models/api.model';
import {
  CallbackEvent,
  InboundNotificationType,
  Signal,
  SignalHandler,
} from '../models/websocket.model';

/**
 * Dispatch-count tests for AppFacade's WebSocket bootstrap.
 *
 * <p>These deliberately use the REAL NotificationService, ClientApiService and
 * WebSocketHandlerService (only the socket, config, translation and transformer
 * collaborators are mocked) and drive the real AppFacade. That combination is
 * the point: NotificationService.init() delegates to the same ClientApiService
 * singleton, so if AppFacade also calls clientApiService.init() the service is
 * registered as a socket listener twice and every inbound notification is fanned
 * out twice. app.facade.spec.ts cannot catch this because it mocks
 * ClientApiService, whose stubbed init() never reaches addListener().
 *
 * <p>Invariant: one inbound notification invokes a registered listener once.
 */
describe('AppFacade WebSocket bootstrap — one signal, one listener call', () => {
  let facade: AppFacade;
  let handler: WebSocketHandlerService;
  let notifications: NotificationService;

  let wsConnectionSpy: jasmine.SpyObj<WebSocketConnectionService>;
  let textTransformerSpy: jasmine.SpyObj<TextTransformerService>;
  let personAttributesService: jasmine.SpyObj<PersonAttributesService>;
  let attributesDelivered$: Subject<Record<string, unknown>>;

  /** Callbacks captured when WebSocketHandlerService.init() calls connect(). */
  let capturedCallbacks: any;

  /** Listener registered through the public NotificationService API. */
  let listener: jasmine.SpyObj<SignalHandler>;

  const authData: AuthData = {
    accountId: 'acc-1',
    name: 'Guest',
    clientSessionId: 'sess-1',
    extras: { newSession: false }
  };

  beforeEach(() => {
    capturedCallbacks = null;
    attributesDelivered$ = new Subject<Record<string, unknown>>();

    wsConnectionSpy = jasmine.createSpyObj<WebSocketConnectionService>(
      'WebSocketConnectionService',
      ['connect', 'sendMessage', 'disconnect', 'isConnected', 'hasWebSocketInstance', 'reconnect',
       'resetConnectionAttempts']
    );
    wsConnectionSpy.connect.and.callFake((_url: string, callbacks: any) => {
      capturedCallbacks = callbacks;
    });

    textTransformerSpy = jasmine.createSpyObj<TextTransformerService>(
      'TextTransformerService', ['transform']);

    const queryParamsManager = jasmine.createSpyObj<QueryParamsManagerService>(
      'QueryParamsManagerService',
      ['initialize', 'getCombinedAttributes'],
      { attributesDelivered$: attributesDelivered$.asObservable() }
    );
    personAttributesService = jasmine.createSpyObj<PersonAttributesService>(
      'PersonAttributesService', ['upsertPersonAttributes']);
    personAttributesService.upsertPersonAttributes.and.returnValue(of({} as any));

    const chatFacade = jasmine.createSpyObj<ChatFacade>(
      'ChatFacade',
      ['setUserData', 'setSessionId', 'loadMessageHistory',
        'markAwaitingWelcomeFirstMessage', 'sendMessage'],
      { messages$: of([]), isLoading$: of(false), sessionId$: of('') }
    );

    const configService = jasmine.createSpyObj<ConfigService>(
      'ConfigService',
      ['initializeConfig', 'updateConfig', 'getConfig', 'getCurrentConfig', 'refresh', 'getToolkitConfig']);
    configService.getCurrentConfig.and.returnValue({ config: { canChangeLanguage: false } } as any);
    configService.getConfig.and.returnValue(of({ config: {} } as any));
    // Must be truthy: ClientApiService.openWebSocketConnection() returns early
    // without a toolkit config, which would leave the socket uninitialised. No
    // `callback` key, so the handler's optional callback hooks stay inert.
    configService.getToolkitConfig.and.returnValue({} as any);

    const sessionService = jasmine.createSpyObj<SessionService>('SessionService', ['createSession']);
    sessionService.createSession.and.returnValue(of({ inboxId: 'inbox-x' } as any));
    const userService = jasmine.createSpyObj<UserService>('UserService', ['initializeUser']);
    const authApiService = jasmine.createSpyObj<AuthApiService>('AuthApiService', ['login', 'logout']);
    const configApiService = jasmine.createSpyObj<ConfigApiService>(
      'ConfigApiService', ['getConfiguration', 'getSupportedLanguages']);
    const loadingService = jasmine.createSpyObj<LoadingService>(
      'LoadingService', ['setConfigLoading', 'setAuthLoading', 'setSessionLoading']);
    const storageService = jasmine.createSpyObj<StorageService>('StorageService',
      ['setMyContactId', 'setClientSessionId', 'setName', 'getClientSessionId',
        'clearClientSessionId', 'setLoggedInDetails', 'getLoggedInDetails']);
    const themeService = jasmine.createSpyObj<ThemeService>('ThemeService', ['applyThemeWithFont']);
    const headerService = jasmine.createSpyObj<HeaderService>('HeaderService', ['setLanguages']);
    const translationService = jasmine.createSpyObj<TranslationService>(
      'TranslationService', ['instant', 'getCurrentLanguage']);
    translationService.getCurrentLanguage.and.returnValue('en');
    translationService.instant.and.returnValue('');

    TestBed.configureTestingModule({
      providers: [
        AppFacade,
        // Real collaborators — the wiring under test.
        ClientApiService,
        NotificationService,
        WebSocketHandlerService,
        { provide: WebSocketConnectionService, useValue: wsConnectionSpy },
        { provide: TextTransformerService, useValue: textTransformerSpy },
        // Mocked periphery.
        { provide: ChatFacade, useValue: chatFacade },
        { provide: ConfigService, useValue: configService },
        { provide: SessionService, useValue: sessionService },
        { provide: UserService, useValue: userService },
        { provide: AuthApiService, useValue: authApiService },
        { provide: ConfigApiService, useValue: configApiService },
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
    handler = TestBed.inject(WebSocketHandlerService);
    notifications = TestBed.inject(NotificationService);

    listener = jasmine.createSpyObj<SignalHandler>('SignalHandler', ['onNotificationSignal']);
  });

  /**
   * Drives the real auth path into AppFacade.initializeWebSocket(). No host
   * attributes are delivered, so the WS opens on the safety timeout — the same
   * route app.facade.spec.ts uses.
   */
  function bootWebSocket(): void {
    (facade as any).handleAuthenticationSuccess(authData);
    tick(2000); // PERSON_ATTRIBUTES_WAIT_MS safety cap
  }

  /** Fires a server connectionEstablished frame so the handler accepts inbound signals. */
  function fireConnectionEstablished(): void {
    textTransformerSpy.transform.and.returnValue({
      signal: Signal.notification,
      payload: { type: CallbackEvent.connectionEstablished, timestamp: Date.now(), payload: {} }
    } as any);
    capturedCallbacks.onMessage({ data: '{}' });
  }

  /** Fires a server NewMessages frame carrying a single message. */
  function fireNewMessages(): void {
    textTransformerSpy.transform.and.returnValue({
      signal: Signal.notification,
      payload: {
        type: InboundNotificationType.NewMessages,
        timestamp: Date.now(),
        payload: { messages: [{ id: 'CHANNEL_MESSAGE_ID_1' }], inboxId: 'inbox_S_1' }
      }
    } as any);
    capturedCallbacks.onMessage({ data: '{}' });
  }

  // -------------------------------------------------------------------------
  // Wiring: the socket listener must be registered exactly once
  // -------------------------------------------------------------------------

  it('registers the socket listener exactly once during WebSocket bootstrap', fakeAsync(() => {
    const addListenerSpy = spyOn(handler, 'addListener').and.callThrough();

    bootWebSocket();

    expect(addListenerSpy).toHaveBeenCalledTimes(1);
    discardPeriodicTasks();
  }));

  // -------------------------------------------------------------------------
  // Behaviour: a real inbound notification reaches the listener once
  // -------------------------------------------------------------------------

  it('dispatches a server NewMessages frame to a registered listener exactly once', fakeAsync(() => {
    bootWebSocket();
    notifications.receiveNotification(InboundNotificationType.NewMessages, listener);

    fireConnectionEstablished();
    discardPeriodicTasks(); // connection monitor interval

    fireNewMessages();

    expect(listener.onNotificationSignal).toHaveBeenCalledTimes(1);
  }));

  // -------------------------------------------------------------------------
  // Behaviour: the client-side session-timeout injection also fans out once.
  // This path drives the logout call in ChatFacade, and reaches listeners
  // without needing a live connection.
  // -------------------------------------------------------------------------

  it('injects a session-timeout signal to a registered listener exactly once', fakeAsync(() => {
    bootWebSocket();
    notifications.receiveNotification(InboundNotificationType.NewMessages, listener);

    capturedCallbacks.onDisconnect({ code: 1008, reason: 'test' });

    expect(listener.onNotificationSignal).toHaveBeenCalledTimes(1);
    discardPeriodicTasks();
  }));
});
