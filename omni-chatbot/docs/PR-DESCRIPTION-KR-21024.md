# Omni Chatbot 3.0.10 — Reliable message delivery across invoker upgrades + CDN-resilient boot

**Tickets:** [KR-21024](https://antbrains.atlassian.net/browse/KR-21024) (primary) · [KR-21091](https://antbrains.atlassian.net/browse/KR-21091) · [KR-21121](https://antbrains.atlassian.net/browse/KR-21121)
**Version:** `3.0.10-1` (on top of released `3.0.9`, launcher `v7`)

---

## Summary

Users stopped receiving chatbot messages (including session-timeout notices) after an invoker upgrade, even though the chat looked healthy. This PR fixes the two independent root causes behind that (KR-21024), makes the chatbot boot path survive invoker restarts via CDN caching + preflight elimination (KR-21091), and ships a revamped Integration Settings page with a live preview and a "Try It Live" demo page.

---

## RCA & Fix

### 1. KR-21024 — Messages silently dropped after invoker upgrade (WebSocket auth loss)

**RCA:** WebSocket frame authentication resolved the account via a **node-local static `WsConnectionStore`** (per-classloader). An invoker upgrade replaces the classloader, wiping this store while browser WS connections stay open. Every frame on a pre-upgrade connection then resolved to "unauthenticated":

- User messages were dropped at `WsRequestHandler` (`NO AUTHORIZED ACCOUNT FOUND`) — **silently**.
- Pings still received pongs (`WsConnectionPingHandler` replies unconditionally), so the client considered the connection **healthy** and the frontend pong-timeout reconnect never fired. The failure was invisible and permanent until a manual refresh.

**Fix:**
- The distributed `ConnectionStore` (Infinispan) now also keeps a **reverse index** `chatbot-connection-rev-<connectionId> → accountId` (prefix nests under `chatbot-connection-`, so existing `deleteAll` cleanup covers it).
- New `WsAuthorizationRecovery.resolveAccountId`: local store lookup → distributed reverse-index fallback → **re-populates the local store** with the live `WsConnection` from the event.
- Wired into the authenticate paths of `WsRequestHandler`, `WsConnectionPingHandler`, and `WsConnectionClosedHandler`.
- Recovery is instant on the first frame after upgrade (≤10s via the ping cycle).

### 2. KR-21024 — Session-timeout message never delivered (stale ActiveMQ session)

**RCA:** `ActiveMQProducer` cached its JMS session forever. After a broker hiccup/restart the cached session was dead; sends of `websocket-chatbot-messages` (the session-timeout delivery path SDK monitor → `ChatBotMessageSender` → ActiveMQ → WS handler) failed without recovery — e.g. "user deleted but timeout message not delivered".

**Fix:** `ActiveMQProducer` is now **self-healing** — on send failure it discards the stale session, recreates it, and retries. Covered by new unit + integration tests (see Testing).

### 3. KR-21091 — Chatbot fails to boot during invoker upgrade window (config request storm)

**RCA:** Every chatbot open sent `Content-Type: application/json` on bodyless GETs, forcing a **CORS preflight** (OPTIONS) before `GET /chatbot/config`, and `/config` was served only by the origin (extension). During an invoker restart, nginx logged mass `OPTIONS /chatbot/config 499` — the browser never got to the real GET, so the chatbot failed to boot exactly when customers' pages were loading it.

**Fix:**
- Removed `Content-Type` from all bodyless GETs (launcher + iframe `ApiService`) → config/supportedLanguages are CORS-"simple", **no preflight at all**; `Access-Control-Max-Age: 7200` caches the remaining preflights (session-header APIs).
- `GET /chatbot/{v}/config`, `/{v}/supportedLanguages`, `/launcher-file` now send `CACHE_PUBLIC_30MIN` (`s-maxage=1800`) and the iframe fetches the **versioned** URLs → CDN-cacheable, served from the edge even while the invoker restarts.
- `launcher.js` served CDN-only s-maxage so changes propagate within one CDN TTL.
- **Freshness preserved for admins:** the Integration Settings live preview uses a dedicated **uncached** `GET /chatbot/config/preview` endpoint (`no-store`; iframe switches via `?chatbotPreview=1`), so just-saved settings always show instantly. Customer embeds keep the cached path.
- Release-notes upgrade section documents the ≤30-min propagation and CloudFront invalidation paths.

### 4. Integration Settings revamp + Live Preview + Try It Live

- **Live Preview** sidebar: pixel-parity static replica of bubble + chat window (header, bubbles, footer, full-size mode) that updates live from **unsaved** form values; expandable to real launcher dimensions.
- **TRY IT LIVE**: server-served demo page `GET /chatbot/preview` embedding the real one-line launcher script against saved settings — full production path, refreshable/shareable.
- One-line integration script, collapsible sections (collapsed by default), unified card headers, layout/scroll fixes, CSP headers for the preview page.
- Fixed latent bug found on the way: `GET /chatbot/supportedLanguages` returned HTTP 500 (raw kSDK `Set<Language>` not JSON-serializable) — now maps to `{code,name}`.

### 5. Other fixes in this PR

| Change | Notes |
|---|---|
| KR-21121: image-mode label fields now render | field renderer fix |
| Selected language preserved across logout | |
| Session-timeout UX | footer hidden permanently, typing bubble suppressed after timeout |
| Header "Close" → "Minimize" | correct icon (`remove`), `matTooltip` instead of `title` |
| Login failure handling | `handleAuthenticationFailure()` clears the stuck "Authenticating..." loader and degrades into session creation (also used by the admission/queue path) |
| Text field phantom scrollbar on Retina | JS-toggled scrollbar visibility |
| JWT session support + appliance-manager gate | `GuestRequestAuthenticator` / auth constants |
| Warm-pool role handling | null-guard `resolveRoleId`, persist updated roles to pool store |
| Launcher CSS via `<link>` | replaces fetch+inline injection |
| Message animation polish | removed `fadeInUp` animation, reorganized CSS rule order (message-bubble, form-message) |
| Test dependencies | embedded Artemis broker (`artemis-server`/`artemis-jms-client` 2.40.0, test scope) for the ActiveMQ integration tests |
| Cleanup | dead `WorkspaceService`/endpoints removed, localStorage access consolidated into `StorageService`, debug `console.log`s removed, invoker load/unload logs added |
| Internal docs | RCA/analysis notes included for reviewers: `KR-21024-multifield-rca.md`, `KR-21091-rca.md`, `sdk-session-timeout-cross-invoker-rca.md`, `session-timeout-delivery-fixes.md`, `grilling-session-3.0.6.md` |

### 6. Merge of `release/omni-chatbot` (3.0.9 / KR-21161) — conflict resolutions

- `app.facade.ts`: kept **both** `notifyHostIfServiceUnavailable` (KR-21161 downtime overlay) and `handleAuthenticationFailure`; login error path = unreachable-server → overlay, other errors → session fallback.
- `launcher-core.ts`: adopted KR-21161 `beginIframeLoad` (backend-down detection) and preserved preview mode by passing `?chatbotPreview=1` at the call site (retry-safe).
- Versions: extension `3.0.10-1`, launcher `v7` (kept consistent in `.env` + `launcher.properties`), release notes re-ordered — this branch's work is now **Version 3.0.10**, above the released 3.0.9.

---

## Testing

**Automated (all green, run on the merged branch):**

| Suite | Result |
|---|---|
| Java (`gradle test`) | **36 test classes, 163 tests, 0 failures** — BUILD SUCCESSFUL |
| Angular (`ng test`, headless Chrome) | **971 tests, 0 failures** |
| Launcher embed-compatibility E2E (`npm run test:launcher`, real Chrome) | **64/64 checks passed** (launcher v7) |

- New `ActiveMQProducerTest` (4 tests) — stale-session recovery logic (mocked JMS)
- New `ActiveMQProducerIntegrationTest` (4 tests) — real embedded Artemis broker
- Load test script added: `../loadtest/session-timeout-load.js` (+ README) for the session-timeout delivery path

**Manual / QA verification:**

- Upgrade-window scenario: before the fix, post-upgrade logs showed `ping request for unauthenticated connectionId` and dropped user messages; after the fix, frames recover to `ping request for accountId <id>` and messages deliver (verified via SigNoz log export on QA).
- Integration Settings: preview reflects unsaved edits live; Try It Live opens the production embed with saved settings; saved config changes appear instantly in preview (uncached endpoint) and within CDN TTL for customers.
- Chatbot boot: `GET /config` issues **no OPTIONS preflight**; versioned URL observed CDN-cached on QA CloudFront.

---

## Possible regression areas — and what covers each

1. **WebSocket message handling** — every WS frame now passes through `WsAuthorizationRecovery` (request, ping, close).
   *Covered by:* manual QA on the upgrade scenario (SigNoz log evidence above: `unauthenticated connectionId` → recovered `accountId`); brand-new connections unchanged (recovery only activates on a local-store miss). No dedicated JUnit for the WS handlers — **primary manual QA focus area**.
   *Watch for:* auth of fresh connections, connection-close cleanup of both index directions.

2. **ActiveMQ delivery** — producer session recreate on failure.
   *Covered by:* `ActiveMQProducerTest` — happy path sends once (no re-open); broker-induced "Session is closed" recreates connection and retries exactly once; deliberate `close()` throws and does NOT resurrect (no leak); 50 concurrent senders all succeed serialized through one producer. `ActiveMQProducerIntegrationTest` (embedded Artemis) — real publish/subscribe delivery; real self-heal after the connection is closed underneath it; post-`close()` nothing delivered; 50 concurrent real senders, no loss/corruption. Plus `../loadtest/session-timeout-load.js` for the end-to-end delivery path under load.
   *Watch for:* duplicate sends on retry under a sustained broker outage.

3. **Config caching (functional change for admins)** — Integration Settings changes reach end users within ≤**30 minutes** (CDN/browser TTL) unless CloudFront is invalidated.
   *Covered by:* `ChatBotUIServiceTest` (FullUrl / PathOnly / ErrorHandling suites) for URL & version substitution; `ChatBotResourceCorsTest` Configuration + SupportedLanguages endpoint suites for the endpoint contract; manual CDN-hit verification on QA CloudFront (`Hit from cloudfront`); preview freshness verified manually via the uncached `/config/preview`. Documented in the release-notes upgrade section.

4. **CORS** — `Content-Type` removed from GETs; ACAO policy unchanged (`*`).
   *Covered by:* `CorsResponseFilterTest` — 7 nested suites (header addition, preflight OPTIONS, HTTP methods, paths, multiple invocations, edge cases, integration) and `ChatBotResourceCorsTest` — 6 nested suites (config, session, messages, supportedLanguages, transcript, UI assets). All passing.

5. **Login/boot error path** — merged flow: unreachable server (0/502/503/504) → KR-21161 downtime overlay; other errors → session-boot fallback; the admission/queue failure path shares `handleAuthenticationFailure`.
   *Covered by:* `app.facade.spec.ts` (updated for both paths) within the 971-test Angular suite; concurrency Java suites (`ConcurrencyConfigTest`, `ConcurrencyManagerTest`, `QueueStoreTest`, `SlotStoreTest`, `WaitTimeEstimatorTest`) for the admission side.

6. **Launcher v7 embeds** (merged from 3.0.9) — preview mode (`?chatbotPreview=1`) now flows through `beginIframeLoad`.
   *Covered by:* launcher E2E suite, **64/64 passed on the merged code** — legacy `new Chatbot(options)` embeds (fast + slow core, late init, Adani replica incl. production timing), modern one-liner, admin-config bubble, config precedence, downtime overlay (first-open, mid-session `serviceUnavailable`, reload-to-error-page, healthy reload), bootstrap-once guards.
   *Watch for:* Try It Live bypassing caches while customer embeds stay cached (manually checked on QA).

7. **Session-timeout UX** — footer/typing-bubble suppression must not leak into normal restarts.
   *Covered by:* `timeline-view` component specs (session-timeout observables mocked and exercised) within the Angular suite; manual restart-flow check.

8. **One-time upgrade note** — WS connection entries are re-namespaced; sessions open at the exact moment of the upgrade lose server-push until their next reconnect (self-heals; documented in release notes). Verified as part of the QA upgrade scenario in (1).

> Note: this branch also repaired pre-existing Angular spec debt so the whole suite is green — mocks updated for `TimelineViewComponent` (session-timeout observables), `AppComponent` (`WebSocketHandlerService` + concurrency observables), and outdated assertions aligned with current intended behavior (`camera-field` `image/*`, `file-field` `fileTypes` mapping, `message-bubble` `hasForm` with empty pages). Test-only changes, no production code touched.
