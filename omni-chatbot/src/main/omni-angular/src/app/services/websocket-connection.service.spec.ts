import { TestBed } from '@angular/core/testing';
import { WebSocketConnectionService } from './websocket-connection.service';
import { StorageService } from './storage.service';

/**
 * Unit tests for {@link WebSocketConnectionService} covering the two fixes shipped
 * for KR-21024:
 *
 * 1. **WS URL parameter name** — the query param must be {@code clientSessionId}
 *    (what the backend reads), NOT the old {@code chatbotSessionId}.
 *
 * 2. **Separator logic** — when the base URL already contains a {@code ?}
 *    (e.g. {@code wss://host/ws?lang=en}), the session param must be appended
 *    with {@code &}, not a second {@code ?} which would corrupt the lang value.
 *
 * 3. **webSocket not nulled on close** — {@code onclose} must NOT set
 *    {@code this.webSocket = null}; nulling it prevented a later {@code disconnect()}
 *    from calling {@code rws.close()} to stop the internal retry loop.
 *
 * ReconnectingWebSocket wraps the GLOBAL {@code WebSocket}. Rather than try to
 * mock the (getter-only) ES module default export, we replace {@code window.WebSocket}
 * with a fake that captures the URL it is constructed with — this is exactly the
 * fully-resolved URL the service built (base + separator + clientSessionId).
 */
describe('WebSocketConnectionService', () => {
  let service: WebSocketConnectionService;
  let storageService: jasmine.SpyObj<StorageService>;

  /** URL the fake native WebSocket was constructed with (the fully-built WS URL). */
  let capturedUrl: string;
  /** Most recent fake native socket, so tests can dispatch a close event onto it. */
  let lastFakeSocket: FakeWebSocket | null;

  const OriginalWebSocket = (window as any).WebSocket;

  /** Minimal EventTarget-backed native-WebSocket stand-in that records its URL. */
  class FakeWebSocket extends EventTarget {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    url: string;
    readyState = FakeWebSocket.OPEN;
    onopen: ((ev?: any) => void) | null = null;
    onclose: ((ev?: any) => void) | null = null;
    onerror: ((ev?: any) => void) | null = null;
    onmessage: ((ev?: any) => void) | null = null;
    close = jasmine.createSpy('nativeClose');
    send = jasmine.createSpy('nativeSend');

    constructor(url: string) {
      super();
      this.url = url;
      capturedUrl = url;
      lastFakeSocket = this;
    }
  }

  /** RWS resolves the URL through a promise; flush the microtask/macrotask queue. */
  async function flushConnect(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  beforeEach(() => {
    capturedUrl = '';
    lastFakeSocket = null;
    (window as any).WebSocket = FakeWebSocket as any;

    storageService = jasmine.createSpyObj<StorageService>('StorageService', [
      'getClientSessionId', 'getLoggedInDetails', 'setClientSessionId'
    ]);
    storageService.getClientSessionId.and.returnValue('sess-abc');

    TestBed.configureTestingModule({
      providers: [
        WebSocketConnectionService,
        { provide: StorageService, useValue: storageService }
      ]
    });

    service = TestBed.inject(WebSocketConnectionService);
  });

  afterEach(() => {
    // Stop any RWS retry loop and restore the real WebSocket for other suites.
    service.disconnect();
    (window as any).WebSocket = OriginalWebSocket;
  });

  // -------------------------------------------------------------------
  // URL parameter name
  // -------------------------------------------------------------------

  it('builds WS URL with clientSessionId= (not chatbotSessionId=)', async () => {
    service.connect('wss://host/ext/api/123/', {});
    await flushConnect();
    expect(capturedUrl).toContain('clientSessionId=sess-abc');
    expect(capturedUrl).not.toContain('chatbotSessionId');
  });

  // -------------------------------------------------------------------
  // Separator logic
  // -------------------------------------------------------------------

  it('uses ? separator when base URL has no query string', async () => {
    service.connect('wss://host/ws', {});
    await flushConnect();
    expect(capturedUrl).toMatch(/wss:\/\/host\/ws\?clientSessionId=/);
  });

  it('uses & separator when base URL already contains ?lang=en', async () => {
    service.connect('wss://host/ws?lang=en', {});
    await flushConnect();
    expect(capturedUrl).toContain('?lang=en&clientSessionId=');
    const questionMarks = (capturedUrl.match(/\?/g) || []).length;
    expect(questionMarks).toBe(1);
  });

  // -------------------------------------------------------------------
  // webSocket reference NOT nulled on close
  // -------------------------------------------------------------------

  it('does NOT null webSocket when the underlying socket closes', async () => {
    service.connect('wss://host/ws', {});
    await flushConnect();
    expect(lastFakeSocket).not.toBeNull();

    // Simulate the server closing the connection: RWS forwards this to the
    // service's onclose handler, which must NOT null this.webSocket.
    lastFakeSocket!.dispatchEvent(new CloseEvent('close', { code: 1001, reason: 'going away' }));

    expect(service.hasWebSocketInstance()).toBeTrue();
  });

  it('has no WebSocket instance before connect()', () => {
    expect(service.hasWebSocketInstance()).toBeFalse();
  });
});
