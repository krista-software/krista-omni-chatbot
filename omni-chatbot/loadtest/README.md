# Session-timeout load test (50 concurrent users)

End-to-end load harness that verifies **every** concurrent chatbot user receives the
real session-timeout message — exercising the full path: WS client → platform
(`NettyWsRequestHandler`) → Artemis `websocket-chatbot-messages` → `ChatBotMessageSender`
← SDK `SessionTimeoutMonitor`. This is the real-world counterpart to the JVM-level
`ActiveMQProducerIntegrationTest` (embedded broker) and `ActiveMQProducerTest` (unit).

## Prerequisites
- [k6](https://k6.io) installed (`brew install k6`).
- A deployed chatbot environment (QA) reachable over `wss://`.
- **Session timeout configured LOW** on the invoker for the test. Note the SDK monitor
  sweeps every **15 min** (`SessionTimeoutMonitor` sleep), so end-to-end worst case is
  ~`sessionTimeout + 15min`. Lower both if your build allows, or budget `MAX_DURATION`
  accordingly.

## Authentication (already wired)
`authenticate()` provisions a real per-VU guest session via **`POST /chatbot/authn/login`**
(`source: chatbot`), mirroring the SPA. It captures the session id (`Chatbot-Session-Id`
header / `chatbotSessionId` cookie) and the encoded `X-Krista-Context` cookie, then presents
both on the WS upgrade (as a `Cookie` header — like the browser — and as headers, since the
server's `ChatBotAuthenticator` accepts either).

Each VU then calls **`POST /chatbot/session`** (`getOrCreateSession`) before connecting —
this is **required**: it creates the OmniChannel session that the `SessionTimeoutMonitor`
expires. Without it there is nothing to time out (WS-open only *refreshes* an existing
session's timestamp; it never creates one), so the timeout message is never sent.

- **Pool note:** each login may pop a pre-warmed pool entry, so ensure the pool can serve
  50 (or disable pooling for the run so each VU provisions a fresh guest).
- **Override / pre-provision:** set `-e CHATBOT_SESSION_ID=... -e X_KRISTA_CONTEXT=...` to
  skip login and reuse a known session (single-session smoke), or extend `authenticate()`
  with a `SharedArray` of pre-generated sessions indexed by `__VU` for distinct identities.

## Run
```bash
k6 run \
  -e CHATBOT_BASE="https://extension.<env>/extension/api/<routingId>" \
  -e VUS=50 \
  -e WAIT_MS=180000 \
  loadtest/session-timeout-load.js
```

## Success criteria
- Threshold **`session_timeout_delivery_rate == 1.0`** → all 50 VUs received a message
  flagged `isSessionTimeout: true`. k6 exits non-zero if any user missed it.
- Inspect `session_timeout_latency_ms` (p95/max) for delivery delay, and
  `session_timeout_missing` (must be 0).

## What a failure tells you
- `session_timeout_missing > 0` with a `1008` close beforehand → the real message was
  dropped server-side (the class of bug fixed in `ChatBotMessageSender`/`ActiveMQProducer`).
  Cross-check the extension logs for `NO WEBSOCKET CONNECTION FOUND`, `NO CONNECTION ID
  FOUND`, or `ActiveMQ producer session was closed; recreating...`.
