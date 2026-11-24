// k6 load harness — 50 concurrent chatbot users must each receive the session-timeout message.
//
// This validates the END-TO-END delivery path that the unit/integration tests can only
// approximate: real WS connections through the platform (kristagrand) + Artemis + the
// omni-chatbot extension, with the SDK SessionTimeoutMonitor as the trigger.
//
// PREREQUISITES (see loadtest/README.md):
//   - k6 installed (https://k6.io)
//   - A deployed chatbot env with the session timeout configured LOW for the test.
//   - 50 distinct authenticated sessions (implement authenticate() below).
//
// RUN:
//   k6 run -e CHATBOT_BASE="https://extension.<env>/extension/api/<routingId>" \
//          -e VUS=50 -e WAIT_MS=180000 loadtest/session-timeout-load.js
//
// SUCCESS CRITERIA: threshold `session_timeout_delivery_rate == 1.0` (every VU got it).

import ws from 'k6/ws';
import http from 'k6/http';
import { check } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

const BASE = __ENV.CHATBOT_BASE; // e.g. https://extension.qa-in.eng.krista.app/extension/api/<routingId>
const WS_BASE = (BASE || '').replace(/^http/, 'ws');

const timeoutDelivered = new Counter('session_timeout_delivered');
const timeoutMissing = new Counter('session_timeout_missing');
const timeoutLatencyMs = new Trend('session_timeout_latency_ms', true);
const deliveryRate = new Rate('session_timeout_delivery_rate');

export const options = {
  scenarios: {
    fifty_users: {
      executor: 'per-vu-iterations',
      vus: Number(__ENV.VUS || 50),
      iterations: 1,
      maxDuration: __ENV.MAX_DURATION || '20m',
    },
  },
  thresholds: {
    // Every connected user MUST receive the real session-timeout message.
    session_timeout_delivery_rate: ['rate==1.0'],
  },
};

function safeJson(res, key) {
  try {
    return res.json(key);
  } catch (e) {
    return undefined;
  }
}

// Provisions a real per-VU guest session, mirroring the SPA's POST /chatbot/authn/login
// (AuthApiService.login: 'source: chatbot', JSON body). The server replies with the
// AuthenticationResponse body + the Chatbot-Session-Id response header + Set-Cookie for
// `chatbotSessionId` and `X-Krista-Context` (ChatBotAuthResource.login). We capture the
// session id (= clientSessionId) and the encoded X-Krista-Context so we can present them
// on the WS upgrade exactly like the browser's cookies do.
//
// Override path: set CHATBOT_SESSION_ID (+ X_KRISTA_CONTEXT) to skip login and use
// pre-provisioned sessions instead.
function authenticate() {
  if (__ENV.CHATBOT_SESSION_ID) {
    return { sessionId: __ENV.CHATBOT_SESSION_ID, kristaContext: __ENV.X_KRISTA_CONTEXT || '' };
  }

  const res = http.post(`${BASE}/chatbot/authn/login`, JSON.stringify({}), {
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      source: 'chatbot',
      caller_uri: BASE,
    },
  });
  check(res, {
    'login 200': (r) => r.status === 200,
    'login has accountId': (r) => !!safeJson(r, 'accountId'),
  });

  // Session id == clientSessionId. Prefer the response header, then the cookie, then body.
  const sessionId =
    res.headers['Chatbot-Session-Id'] ||
    (res.cookies['chatbotSessionId'] && res.cookies['chatbotSessionId'][0].value) ||
    safeJson(res, 'clientSessionId');

  // X-Krista-Context is the ENCODED session the server sets as a cookie.
  const kristaContext =
    (res.cookies['X-Krista-Context'] && res.cookies['X-Krista-Context'][0].value) || '';

  // Log the accountId so you can grep the extension logs for this VU's session
  // (e.g. "Received ping request for accountId: <id>", "NO WEBSOCKET CONNECTION
  // FOUND FOR ACCOUNT ID: <id>", "Message from server: Session timed out...").
  const accountId = safeJson(res, 'accountId');
  const name = safeJson(res, 'name');
  console.log(`[VU ${__VU}] login OK accountId=${accountId} name=${name} sessionId=${sessionId}`);

  return { sessionId, kristaContext };
}

// Creates the OmniChannel session via POST /chatbot/session (getOrCreateSession), exactly
// like the SPA does after login. WITHOUT this there is no timeout-eligible session for the
// account, so SessionTimeoutMonitor never sends a timeout message — the WS open only
// REFRESHES an existing session's timestamp, it does not create one. The request must be
// authenticated, so we pass the session headers + cookie.
function createSession(auth) {
  const res = http.post(`${BASE}/chatbot/session`, JSON.stringify({ languageCode: 'en' }), {
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      'Chatbot-Session-Id': auth.sessionId,
      'X-Krista-Context': auth.kristaContext,
      Cookie: `chatbotSessionId=${auth.sessionId}; X-Krista-Context=${auth.kristaContext}`,
    },
    responseType: 'text',
  });
  check(res, {
    'session 200': (r) => r.status === 200,
    'session has inbox': (r) => typeof r.body === 'string' && r.body.indexOf('inbox') !== -1,
  });
  console.log(`[VU ${__VU}] session inbox=${res.body}`);
}

function hasSessionTimeout(parsed) {
  const inner = parsed && parsed.payload && parsed.payload.payload;
  const messages = inner && inner.messages;
  return Array.isArray(messages) && messages.some((m) => m && m.isSessionTimeout === true);
}

export default function () {
  if (!BASE) {
    throw new Error('CHATBOT_BASE env var is required');
  }
  const auth = authenticate();
  if (!auth.sessionId) {
    deliveryRate.add(false);
    timeoutMissing.add(1);
    throw new Error('authenticate() returned no session id');
  }
  // Establish the OmniChannel session so it is eligible for the timeout monitor.
  createSession(auth);
  const url = `${WS_BASE}/chatbot/ws?lang=en`;
  // The WS upgrade auth (ChatBotAuthenticator.handleWsEvent) accepts either a Cookie
  // header (what the browser sends) or a Chatbot-Session-Id header. We send both so the
  // harness is robust regardless of how the env's auth filter resolves the session.
  const params = {
    headers: {
      Cookie: `chatbotSessionId=${auth.sessionId}; X-Krista-Context=${auth.kristaContext}`,
      'Chatbot-Session-Id': auth.sessionId,
      'X-Krista-Context': auth.kristaContext,
    },
  };

  const sessionStart = Date.now();
  let gotTimeout = false;

  const res = ws.connect(url, params, function (socket) {
    socket.on('open', function () {
      // Keep the connection alive while we wait for the server-side timeout.
      socket.setInterval(function () {
        socket.send(JSON.stringify({ signal: 'ping', payload: { reference: `${__VU}-${Date.now()}` } }));
      }, 30000);
    });

    socket.on('message', function (data) {
      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch (e) {
        return;
      }
      if (hasSessionTimeout(parsed)) {
        gotTimeout = true;
        timeoutLatencyMs.add(Date.now() - sessionStart);
        timeoutDelivered.add(1);
        deliveryRate.add(true);
        socket.close();
      }
    });

    socket.on('close', function () {
      if (!gotTimeout) {
        timeoutMissing.add(1);
        deliveryRate.add(false);
      }
    });

    // Stop waiting after WAIT_MS (must exceed the server session timeout + the
    // monitor's sweep interval). 1008 close without a prior timeout message counts
    // as a miss via the 'close' handler above.
    socket.setTimeout(function () {
      socket.close();
    }, Number(__ENV.WAIT_MS || 16 * 60 * 1000));
  });

  check(res, { 'ws upgrade (status 101)': (r) => r && r.status === 101 });
}
