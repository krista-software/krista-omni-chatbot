import { TestBed, fakeAsync, discardPeriodicTasks } from '@angular/core/testing';
import { WebSocketHandlerService } from './websocket-handler.service';
import { WebSocketConnectionService } from './websocket-connection.service';
import { TextTransformerService } from './text-transformer.service';
import { ConfigService } from './config.service';
import { TranslationService } from './translation.service';
import {
  CallbackEvent,
  InboundNotificationType,
  INotificationSignal,
  Signal,
  SignalHandler,
} from '../models/websocket.model';

/**
 * Unit tests for {@link WebSocketHandlerService} covering the session-timeout
 * injection logic and consecutive-disconnect terminal-state detection added for
 * KR-21024.
 *
 * <p>Tests drive {@code onDisconnect} / {@code onMessage} callbacks captured from
 * the mocked {@link WebSocketConnectionService#connect} spy, which avoids any real
 * WebSocket connection while still exercising the handler's real branching logic.
 *
 * <p>Key behaviours tested:
 * <ul>
 *   <li>{@code init()} resets {@code sessionTimedOut} and {@code consecutiveDisconnects}.</li>
 *   <li>{@code connectionEstablished} resets the disconnect counter.</li>
 *   <li>First 1008 close injects session-timeout and sets the dedup guard.</li>
 *   <li>Subsequent 1008 closes are ignored (guard prevents duplicate injection).</li>
 *   <li>{@code markSessionTimedOut()} suppresses injection on later closes.</li>
 *   <li>3 consecutive non-1008 closes do NOT inject (below threshold).</li>
 *   <li>4 consecutive non-1008 closes DO inject (RWS gave up, terminal state).</li>
 *   <li>1012 closes (service restart, client should reconnect) do NOT inject.</li>
 *   <li>Injected message carries {@code isSessionTimeout: true} and the stored sessionId.</li>
 * </ul>
 */
describe('WebSocketHandlerService — session-timeout injection (KR-21024)', () => {
  let service: WebSocketHandlerService;
  let wsConnectionSpy: jasmine.SpyObj<WebSocketConnectionService>;
  let translationSpy: jasmine.SpyObj<TranslationService>;
  let configSpy: jasmine.SpyObj<ConfigService>;
  let textTransformerSpy: jasmine.SpyObj<TextTransformerService>;

  /** Callbacks captured when connect() is called by init(). */
  let capturedCallbacks: any;

  /** Listener that captures injected signals. */
  let capturedSignal: INotificationSignal<InboundNotificationType> | null;
  const listener: SignalHandler = {
    onNotificationSignal(signal) {
      capturedSignal = signal;
    }
  };

  beforeEach(() => {
    capturedCallbacks = null;
    capturedSignal = null;

    wsConnectionSpy = jasmine.createSpyObj<WebSocketConnectionService>(
      'WebSocketConnectionService',
      ['connect', 'sendMessage', 'disconnect', 'isConnected', 'hasWebSocketInstance', 'reconnect',
       'resetConnectionAttempts']
    );
    wsConnectionSpy.connect.and.callFake((_url: string, callbacks: any) => {
      capturedCallbacks = callbacks;
    });

    translationSpy = jasmine.createSpyObj<TranslationService>(
      'TranslationService', ['getCurrentLanguage', 'instant']);
    translationSpy.getCurrentLanguage.and.returnValue('en');

    configSpy = jasmine.createSpyObj<ConfigService>(
      'ConfigService', ['getToolkitConfig', 'initializeConfig', 'updateConfig', 'getCurrentConfig', 'getConfig']);
    configSpy.getToolkitConfig.and.returnValue(null); // no callback registered

    textTransformerSpy = jasmine.createSpyObj<TextTransformerService>(
      'TextTransformerService', ['transform']);

    TestBed.configureTestingModule({
      providers: [
        WebSocketHandlerService,
        { provide: WebSocketConnectionService, useValue: wsConnectionSpy },
        { provide: TextTransformerService, useValue: textTransformerSpy },
        { provide: ConfigService, useValue: configSpy },
        { provide: TranslationService, useValue: translationSpy },
      ]
    });

    service = TestBed.inject(WebSocketHandlerService);
    service.addListener(listener);
    service.init('wss://host/ext/api/123/');
  });

  // Helper to fire a fake connectionEstablished server message. The handler
  // parses via textTransformer.transform(event.data), so stub it to return the
  // connectionEstablished-shaped signal the handler branches on.
  function fireConnectionEstablished(): void {
    textTransformerSpy.transform.and.returnValue({
      signal: Signal.notification,
      payload: { type: CallbackEvent.connectionEstablished, timestamp: Date.now(), payload: {} }
    } as any);
    capturedCallbacks.onMessage({ data: '{}' });
  }

  // Helper to fire a disconnect event with a given close code
  function disconnect(code: number): void {
    capturedCallbacks.onDisconnect({ code, reason: 'test' });
  }

  // -----------------------------------------------------------------------
  // init() resets state
  // -----------------------------------------------------------------------

  it('init() is a no-op on a second call (idempotent)', () => {
    service.init('wss://host/ext/api/123/');
    // connect() should only have been called once (in beforeEach)
    expect(wsConnectionSpy.connect).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // 1008 — session timeout injection
  // -----------------------------------------------------------------------

  it('first 1008 close: injects a session-timeout signal to listeners', () => {
    disconnect(1008);
    expect(capturedSignal).not.toBeNull();
    const msg = capturedSignal!.payload.payload['messages'][0];
    expect(msg['isSessionTimeout']).toBeTrue();
  });

  it('first 1008 close: injected signal has type NewMessages', () => {
    disconnect(1008);
    expect(capturedSignal).not.toBeNull();
    expect(capturedSignal!.payload.type).toBe(InboundNotificationType.NewMessages);
  });

  it('second 1008 close: does NOT inject again (dedup guard)', () => {
    disconnect(1008);
    capturedSignal = null; // clear

    disconnect(1008);
    expect(capturedSignal).toBeNull();
  });

  it('markSessionTimedOut(): prevents injection on a subsequent 1008 close', () => {
    service.markSessionTimedOut();
    disconnect(1008);
    expect(capturedSignal).toBeNull();
  });

  // -----------------------------------------------------------------------
  // 1012 — service restart, client should reconnect, NOT session timeout
  // -----------------------------------------------------------------------

  it('1012 close: does NOT inject session-timeout', () => {
    disconnect(1012);
    expect(capturedSignal).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Consecutive disconnects — terminal-state detection
  // -----------------------------------------------------------------------

  it('3 consecutive non-1008 closes: no injection (below MAX_CONSECUTIVE_DISCONNECTS=4)', () => {
    disconnect(1001);
    disconnect(1001);
    disconnect(1001);
    expect(capturedSignal).toBeNull();
  });

  it('4 consecutive non-1008 closes: injects session-timeout (RWS gave up)', () => {
    disconnect(1001);
    disconnect(1001);
    disconnect(1001);
    disconnect(1001);
    expect(capturedSignal).not.toBeNull();
    const msg = capturedSignal!.payload.payload['messages'][0];
    expect(msg['isSessionTimeout']).toBeTrue();
  });

  it('only one injection when consecutiveDisconnects >= 4 (guard stays set)', () => {
    disconnect(1001);
    disconnect(1001);
    disconnect(1001);
    disconnect(1001);
    capturedSignal = null; // clear

    disconnect(1001); // 5th — should be suppressed
    expect(capturedSignal).toBeNull();
  });

  it('connectionEstablished resets the consecutive-disconnect counter', fakeAsync(() => {
    // Accumulate 3 disconnects — one below the threshold
    disconnect(1001);
    disconnect(1001);
    disconnect(1001);
    expect(capturedSignal).toBeNull();

    // Server confirms a new connection — counter resets
    fireConnectionEstablished();
    discardPeriodicTasks(); // clean up the monitoring interval

    // 3 more disconnects should still be below the threshold (counter was reset)
    disconnect(1001);
    disconnect(1001);
    disconnect(1001);
    expect(capturedSignal).toBeNull();
  }));

  // -----------------------------------------------------------------------
  // setSessionId() — injected message carries the stored sessionId
  // -----------------------------------------------------------------------

  it('injected message carries the sessionId set via setSessionId()', () => {
    service.setSessionId('inbox_S_my-session-id');
    disconnect(1008);

    expect(capturedSignal).not.toBeNull();
    const msg = capturedSignal!.payload.payload['messages'][0];
    expect(msg['inboxId']).toBe('inbox_S_my-session-id');
  });

  // -----------------------------------------------------------------------
  // Translation fallback
  // -----------------------------------------------------------------------

  it('injected message body falls back to English for an unknown language', () => {
    translationSpy.getCurrentLanguage.and.returnValue('zz'); // unsupported
    disconnect(1008);

    expect(capturedSignal).not.toBeNull();
    const msg = capturedSignal!.payload.payload['messages'][0];
    expect(msg['message']).toContain('Session timed out');
  });

  // -----------------------------------------------------------------------
  // Offline suppression — a client that lost its network must NOT be told its
  // session timed out (the teardown is irreversible and the server session is
  // untouched). Only the count-based branch is gated; an explicit 1008 from the
  // server stays authoritative.
  // -----------------------------------------------------------------------

  // navigator.onLine is a readonly getter, so override it per-spec and restore after.
  function setBrowserOnline(online: boolean): void {
    Object.defineProperty(navigator, 'onLine', {
      value: online,
      configurable: true
    });
  }

  afterEach(() => {
    // Drop the override so the real navigator.onLine getter is restored.
    delete (navigator as any).onLine;
    // disconnect() unregisters the window 'online' listener. Without this the
    // listener outlives the spec, and a later spec dispatching an online event
    // would drive this defunct instance and its stale mock.
    service.disconnect();
  });

  it('4 consecutive closes while OFFLINE: does NOT inject a false session-timeout', () => {
    setBrowserOnline(false);

    disconnect(1001);
    disconnect(1001);
    disconnect(1001);
    disconnect(1001);

    expect(capturedSignal).toBeNull();
  });

  it('1008 while OFFLINE: still injects (explicit server close stays authoritative)', () => {
    setBrowserOnline(false);

    disconnect(1008);

    expect(capturedSignal).not.toBeNull();
    const msg = capturedSignal!.payload.payload['messages'][0];
    expect(msg['isSessionTimeout']).toBeTrue();
  });

  it('online event after an offline burst: rebuilds a FRESH socket (not rws.reconnect)', () => {
    setBrowserOnline(false);
    disconnect(1001);
    disconnect(1001);
    disconnect(1001);
    disconnect(1001);
    expect(capturedSignal).toBeNull();

    setBrowserOnline(true);
    window.dispatchEvent(new Event('online'));

    // Must tear down and construct a NEW ReconnectingWebSocket. rws.reconnect()
    // is a silent no-op once maxRetries is exhausted: _connect() takes
    // _connectLock then returns at the maxRetries guard WITHOUT releasing it, so
    // the lock stays true forever and every later _connect() bails immediately.
    expect(wsConnectionSpy.disconnect).toHaveBeenCalled();
    expect(wsConnectionSpy.connect).toHaveBeenCalledTimes(2); // initial + rebuild
    expect(wsConnectionSpy.reconnect).not.toHaveBeenCalled();

    // init() reset the counter: 3 further closes stay below the threshold. Without
    // the reset the stale count (>=4) would trip on the first close back online.
    disconnect(1001);
    disconnect(1001);
    disconnect(1001);
    expect(capturedSignal).toBeNull();
  });

  it('online event does NOT resurrect a session already marked timed out', () => {
    disconnect(1008); // real timeout — guard set
    wsConnectionSpy.connect.calls.reset();

    window.dispatchEvent(new Event('online'));

    expect(wsConnectionSpy.connect).not.toHaveBeenCalled();
  });

  it('online event after disconnect(): no rebuild (listener was unregistered)', () => {
    service.disconnect();
    wsConnectionSpy.connect.calls.reset();

    window.dispatchEvent(new Event('online'));

    expect(wsConnectionSpy.connect).not.toHaveBeenCalled();
  });

  it('offline suppression is deferral, not loss: a close once back ONLINE still injects', () => {
    setBrowserOnline(false);
    disconnect(1001);
    disconnect(1001);
    disconnect(1001);
    disconnect(1001);
    expect(capturedSignal).toBeNull();

    // Back online, but the server keeps rejecting: the session really is dead.
    setBrowserOnline(true);
    disconnect(1001);
    disconnect(1001);
    disconnect(1001);
    disconnect(1001);

    expect(capturedSignal).not.toBeNull();
    const msg = capturedSignal!.payload.payload['messages'][0];
    expect(msg['isSessionTimeout']).toBeTrue();
  });
});
