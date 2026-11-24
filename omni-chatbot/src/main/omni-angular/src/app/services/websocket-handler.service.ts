import { Injectable } from '@angular/core';
import { BehaviorSubject, interval, Subscription } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import {
  ISignal,
  SignalPayload,
  Signal,
  SignalHandler,
  INotificationSignal,
  InboundNotificationType,
  OutboundNotificationType,
  CallbackEvent,
} from '../models/websocket.model';
import { WebSocketConnectionService, WS_MAX_RETRIES } from './websocket-connection.service';
import { TextTransformerService } from './text-transformer.service';
import { ConfigService } from './config.service';
import { TranslationService } from './translation.service';

@Injectable({
  providedIn: 'root'
})
export class WebSocketHandlerService {
  private readonly RECONNECT_OFFSET = 30;
  private readonly RELOAD_OFFSET = 120;

  private webSocket: WebSocketConnectionService | null = null;
  private listeners: SignalHandler[] = [];
  private isConnected = false;
  private connectionCheckInterval: Subscription | undefined;
  private lastServerCommunicationTime = 0;
  private readonly allowedSignals = [
    Signal.notification,
    Signal.ping,
    Signal.authenticate,
  ];
  private lastPingReference: string = "";
  // Live session/inbox id, supplied by AppComponent, used to stamp the synthetic
  // session-timeout message injected on a 1008 close.
  private sessionId: string = "";
  // WS close codes after which we stop reconnecting and surface a session timeout.
  private readonly STOP_RECONNECT_CODES = [
    1008, // Policy Violation — backend uses this for "user not authorised" / session ended
  ];
  // Guards against duplicate session-timeout messages: ReconnectingWebSocket can
  // close with 1008 repeatedly across reconnect attempts, and each injected
  // message carries a fresh id (so the facade's id-based dedup cannot catch it).
  // Set on the first 1008 timeout, reset on init() for the next session.
  private sessionTimedOut = false;
  // Terminal-state detection: counts closes since the last server-confirmed
  // connectionEstablished. A dead session (account deleted server-side) shows up
  // as reconnects that OPEN but are closed by the server before the app-level
  // handshake completes — and the close code is not always a clean 1008 (the
  // platform can substitute 1011 "No session found"), so the 1008 branch alone
  // can miss it. Once ReconnectingWebSocket exhausts maxRetries it goes silent
  // forever: no notice, footer still visible, sends swallowed. After
  // MAX_CONSECUTIVE_DISCONNECTS we therefore surface the session-timeout
  // teardown ourselves. Reset on connectionEstablished (NOT on socket open —
  // rejected connections do open briefly) and on init().
  //
  // Set to WS_MAX_RETRIES + 1 ON PURPOSE: the first onDisconnect is the original
  // socket dropping, then RWS makes up to `maxRetries` reconnect attempts. The
  // count reaches the threshold only after the initial drop AND every retry has
  // failed — i.e. RWS has truly given up. A lower value would fire the
  // irreversible teardown while a viable retry was still pending, so a slow
  // invoker upgrade whose reconnect succeeds on the last attempt would be torn
  // down as a false "session timeout". Derived from the shared WS_MAX_RETRIES so
  // it can never drift out of sync with websocket-connection's maxRetries.
  private consecutiveDisconnects = 0;
  private readonly MAX_CONSECUTIVE_DISCONNECTS = WS_MAX_RETRIES + 1;

  // Base WS URL of the live session, kept so the online-recovery path can
  // rebuild the connection after RWS has permanently given up.
  private lastBaseUrl: string | null = null;

  private connectionStateSubject = new BehaviorSubject<boolean>(false);
  public connectionState$ = this.connectionStateSubject.asObservable();

  constructor(
    private webSocketConnection: WebSocketConnectionService,
    private textTransformer: TextTransformerService,
    private configService: ConfigService,
    private translationService: TranslationService
  ) {}

  /**
   * Stores the live session/inbox id so an injected session-timeout message
   * carries the correct ids. Called by AppComponent when the session id changes.
   */
  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  /**
   * Marks the session as already timed out so a later 1008 close does NOT
   * inject a synthetic timeout message. Called by the facade when the REAL
   * backend session-timeout message has been received over the socket — the
   * client-side injection must only act as a fallback for the offline case
   * where that real message was missed (no message received, then a 1008 on
   * reconnect). Reset on the next init().
   */
  markSessionTimedOut(): void {
    this.sessionTimedOut = true;
  }

  /**
   * True only when the browser is certain it has no network connection.
   *
   * `navigator.onLine === false` is a reliable NEGATIVE signal (no network
   * route). `true` does NOT guarantee reachable internet, which is why this is
   * only ever used to SUPPRESS the terminal-state teardown: when the answer is
   * ambiguous we fall back to the previous behaviour rather than stranding a
   * user whose session really is dead.
   */
  private isBrowserOffline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine === false;
  }

  /**
   * Recovery when the network comes back.
   *
   * Without this the chat stays silently dead after an offline spell: RWS stops
   * for good once it exhausts `maxRetries`, and WebSocketConnectionService.connect()
   * has its own `connectionAttempts > 3` hard stop.
   *
   * We deliberately do NOT call `rws.reconnect()`. ReconnectingWebSocket cannot be
   * revived after exhausting its retries: `_connect()` takes `_connectLock` and then
   * returns early at the `_retryCount >= maxRetries` guard WITHOUT releasing it, and
   * the lock is only cleared after a socket is actually constructed. The lock is
   * therefore stuck `true` forever, so `reconnect()` — which just resets the retry
   * count and calls `_connect()` — is a silent no-op. (Verified against
   * reconnecting-websocket dist: lock taken at `_connect`, released only after the
   * `new WebSocket(...)` line.) The only reliable recovery is a brand-new instance,
   * which disconnect() + init() produce: disconnect() nulls the RWS reference so
   * connect() constructs a fresh one with a clean lock and retry count.
   *
   * init() also resets consecutiveDisconnects, which is essential — it is already
   * at/over the threshold from the offline burst, so the next close would otherwise
   * immediately inject the false timeout we just suppressed.
   */
  private readonly onlineHandler = (): void => {
    // A real, server-confirmed timeout must never be resurrected.
    if (this.sessionTimedOut || !this.lastBaseUrl) {
      return;
    }
    const baseURL = this.lastBaseUrl;
    this.disconnect();
    this.init(baseURL);
  };

  /**
   * Initialise the WebSocket connection.
   *
   * @param baseURL - Base WS URL (e.g. wss://host/extension/api/<id>/)
   */
  init(baseURL: string): void {
    if (this.webSocket) {
      return;
    }

    this.sessionTimedOut = false;
    this.consecutiveDisconnects = 0;
    this.webSocket = this.webSocketConnection;
    // Retained so onlineHandler can rebuild the socket from scratch.
    this.lastBaseUrl = baseURL;
    // Remove-before-add: init() can run again after a disconnect(), and a
    // duplicate registration would fire the reconnect path once per listener.
    window.removeEventListener('online', this.onlineHandler);
    window.addEventListener('online', this.onlineHandler);
    const self = this;

    // Append ?lang=<user_language> to the WS URL so the backend can set the
    // session language at handshake time — uses an existing round-trip, no
    // new request. Critical for pool-popped sessions (they were pre-warmed
    // in "en" and would otherwise stay English regardless of the user's
    // preference), and also corrects normal-login where the WS-open handler
    // would previously overwrite the session language back to "en".
    const lang = this.translationService.getCurrentLanguage() || 'en';
    const wsUrl = `${baseURL}ws?lang=${encodeURIComponent(lang)}`;

    this.webSocket.connect(wsUrl, {
      onConnect(event) {
        self.connectionStateSubject.next(true);
      },
      onMessage(event) {
        const signalPayloadISignal = self.textTransformer.transform(event.data);

        // Handle connection established
        if (signalPayloadISignal
            && (signalPayloadISignal.signal === Signal.notification
                && signalPayloadISignal.payload["type"] === CallbackEvent.connectionEstablished)) {

          // The server has confirmed the connection is established
          // Set connected state immediately since server confirmation is authoritative
          self.isConnected = true;
          self.consecutiveDisconnects = 0;
          self.connectionStateSubject.next(true);
          self.updateServerCommunicationTime();
          self.monitorConnection();
          self.sendPing();

          const config = self.configService.getToolkitConfig();
          if (config && config.callback) {
            config.callback(CallbackEvent.webSocketConnected);
          }
        } else {
          self.updateServerCommunicationTime();
          self.signalHandler(signalPayloadISignal);
        }
      },
      onDisconnect(event) {
        self.isConnected = false;
        self.consecutiveDisconnects++;
        self.connectionStateSubject.next(false);
        self.stopMonitoringConnection();

        // A 1008 (policy violation) close means the session is no longer valid —
        // typically a server-side session timeout. Surface it as a session-timeout
        // message to the UI instead of silently reconnecting.
        if (event && self.STOP_RECONNECT_CODES.includes(event.code) && !self.sessionTimedOut) {
          self.sessionTimedOut = true;
          self.injectSessionTimeoutMessage();
        } else if (self.consecutiveDisconnects >= self.MAX_CONSECUTIVE_DISCONNECTS
                   && !self.sessionTimedOut
                   && !self.isBrowserOffline()) {
          // Terminal state: repeated closes with no successful app-level handshake
          // in between — the server is rejecting this session (dead/deleted account)
          // but the close code never arrived as a clean 1008. Without this branch,
          // ReconnectingWebSocket exhausts its retries and the chat silently hangs
          // forever (no notice, input still visible, sends swallowed).
          //
          // Gated on connectivity: "N closes with no handshake" is ALSO exactly what
          // a client with no network produces, and this teardown is IRREVERSIBLE
          // (setSessionTimedOut permanently hides the footer). Declaring a session
          // dead because the user's wifi dropped is always wrong — the server session
          // is untouched. When offline we suppress and let onlineHandler reconnect;
          // if the session really is dead the server rejects it once we are back
          // online and this branch fires then, so no detection is lost, only deferred.
          self.sessionTimedOut = true;
          self.injectSessionTimeoutMessage();
        }

        const config = self.configService.getToolkitConfig();
        if (config && config.callback) {
          config.callback(CallbackEvent.webSocketDisconnected);
        }
      },
      onError(event) {
        self.isConnected = false;
        self.connectionStateSubject.next(false);
      }
    });
  }

  private updateServerCommunicationTime(): void {
    this.lastServerCommunicationTime = Date.now();
  }

  private signalHandler(signal: ISignal<SignalPayload>): void {
    if (!this.isConnected) {
      return;
    }

    const notificationSignal = signal as INotificationSignal<InboundNotificationType>;
    switch (signal.signal) {
      case Signal.notification:
        this.listeners.forEach((listener) => {
          listener.onNotificationSignal(notificationSignal);
        });
        break;
      case Signal.pong:
        this.handlePong(signal.payload);
        break;
      default:
        break;
    }
  }

  private handlePong(payload: SignalPayload): void {
    if (payload['reference'] === this.lastPingReference) {
      this.updateServerCommunicationTime();
    } else {
    }

    // Match original app behavior: send another ping after receiving pong
    this.sendPing();
  }

  private monitorConnection(): void {
    this.connectionCheckInterval = interval(this.RECONNECT_OFFSET * 1000).subscribe(() => {
      const timeSinceLastCommunication = Date.now() - this.lastServerCommunicationTime;

      if (timeSinceLastCommunication > this.RELOAD_OFFSET * 1000) {
        // REMOVED: window.location.reload(); - This was causing constant refreshing!
        // Instead, just try to reconnect
        this.sendPing();
      } else if (timeSinceLastCommunication > this.RECONNECT_OFFSET * 1000) {
        this.sendPing();
      }
    });
  }

  private stopMonitoringConnection(): void {
    if (this.connectionCheckInterval) {
      this.connectionCheckInterval.unsubscribe();
      this.connectionCheckInterval = undefined;
    }
  }

  private sendPing(): void {
    // Match original app behavior: delay ping by 10 seconds
    setTimeout(() => {
      this.lastPingReference = uuidv4();
      const pingSignal = {
        signal: Signal.ping,
        payload: {
          reference: this.lastPingReference,
          timestamp: Date.now()
        }
      };
      this.sendSignal(pingSignal);
    }, 10000); // 10 second delay like original app
  }

  addListener(listener: SignalHandler): void {
    this.listeners.push(listener);
  }

  removeListener(listener: SignalHandler): void {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  sendNotification(notification: INotificationSignal<OutboundNotificationType>): void {
    this.sendSignal(notification);
  }

  private sendSignal(signal: ISignal<SignalPayload>): void {
    if (!this.webSocket) {
      return;
    }

    // Check if the connection service actually has a WebSocket instance
    const serviceHasWebSocket = (this.webSocket as any).hasWebSocketInstance?.() || false;
    if (!serviceHasWebSocket && this.isConnected) {
      // Reset our connection state to match reality
      this.isConnected = false;
      this.connectionStateSubject.next(false);
      return;
    }

    // Primary check: handler connection state (server confirmed)
    if (!this.isConnected) {
      return;
    }

    if (this.allowedSignals.includes(signal.signal)) {
      this.webSocket.sendMessage(signal);
    }
  }

  disconnect(): void {
    this.stopMonitoringConnection();
    window.removeEventListener('online', this.onlineHandler);
    if (this.webSocket) {
      this.webSocket.disconnect();
      this.webSocket.resetConnectionAttempts(); // Reset connection attempts
      this.webSocket = null; // Clear the reference
    }
    this.isConnected = false;
    this.connectionStateSubject.next(false);
  }

  isWebSocketConnected(): boolean {
    // Prioritize handler state since it's based on server confirmation
    // The actual WebSocket state might lag behind the server confirmation
    return this.isConnected;
  }

  /**
   * Injects a synthetic session-timeout NewMessages signal to all listeners.
   * Called when the WS closes with a STOP_RECONNECT_CODES code (1008), so the
   * UI is notified of the timeout even though the connection is already gone.
   */
  private injectSessionTimeoutMessage(): void {
    const sessionTimeoutMessage = this.buildSessionTimeoutMessage();
    this.listeners.forEach((listener) => {
      listener.onNotificationSignal(sessionTimeoutMessage);
    });
  }

  /**
   * Builds the synthetic session-timeout NewMessages signal. The single message
   * is flagged {@code isSessionTimeout} so the facade tears down the session and
   * hides the footer, and carries the user-facing timeout notice as its body.
   */
  private buildSessionTimeoutMessage(): INotificationSignal<InboundNotificationType> {
    const creationTime = Date.now();
    const inboxId = this.sessionId || `inbox_S_${uuidv4()}`;
    const messageId = `CHANNEL_MESSAGE_ID_${uuidv4()}`;

    return {
      signal: Signal.notification,
      payload: {
        type: InboundNotificationType.NewMessages,
        timestamp: creationTime,
        payload: {
          messages: [
            {
              id: messageId,
              sessionId: inboxId.replace('inbox_', ''),
              type: 'MessageInform',
              creationTime: creationTime,
              sender: { id: 'system', name: 'Krista' },
              inboxId: inboxId,
              message: this.getSessionTimeoutTranslation(),
              form: { pages: [] },
              copies: {},
              isSessionTimeout: true,
            },
          ],
          inboxId: inboxId,
        },
      },
    };
  }

  /**
   * Returns the session-timeout notice in the user's current language, falling
   * back to English. Self-contained map so it works without an i18n key.
   */
  private getSessionTimeoutTranslation(): string {
    const lang = this.translationService.getCurrentLanguage() || 'en';
    const translations: { [key: string]: string } = {
      en: 'Session timed out. Please refresh to start again.',
      de: 'Sitzung abgelaufen. Bitte aktualisieren Sie, um erneut zu beginnen.',
      es: 'La sesión ha caducado. Por favor, actualice para comenzar de nuevo.',
      fr: 'La session a expiré. Veuillez actualiser pour recommencer.',
      hi: 'सत्र समाप्त हो गया। कृपया फिर से शुरू करने के लिए रीफ्रेश करें।',
    };
    return translations[lang] || translations['en'];
  }
}
