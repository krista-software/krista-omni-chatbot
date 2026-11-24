# Concurrent User Rate-Limiting & Idle Session Management — Spec (as built)

**Ticket area:** omni-chatbot extension (branch `feature/KR-21047`)
**Status:** Implemented; Java + Angular build green; backend unit tests passing.
**Scope rule:** 100% extension-level. No changes to `kristagrand`, core platform, kSDK, or the existing session-timeout (`SessionTimeoutMonitor`).

---

## 1. Goals
1. Per-invoker **concurrent-user cap** with a configurable max (default 100).
2. **FIFO queue** + estimated wait when the cap is reached; auto-admit as slots free.
3. **Idle session management** (client-driven, independent of the backend session-timeout): configurable disconnect with a warning.
4. **Kill switch**: the whole feature is gated by a master flag. When off → byte-for-byte today's behavior.
5. Works identically whether **Faster Startup** (pooled users) is ON or OFF.

## 2. Confirmed decisions
| # | Topic | Decision |
|---|-------|----------|
| Count scope | Per invoker; 1 guest account = 1 user | |
| Multi-tab | Multiple tabs of one account = **1 slot** (ref-counted) | |
| Queue store | KeyValueStore (Infinispan, durable+distributed) + per-node read cache, rehydrate on load | |
| Queue size | Unbounded (very high safety ceiling only, for abuse/alerting) | |
| Config | 3 admin settings in `uiConfigJson` / Integration Settings tab; rest hardcoded | |
| Wait estimate | Throughput-based (Little's Law) with rolling avg of engaged session durations | |
| Queue updates | Lightweight client polling | |
| Idle warning | Derived (not admin-set): `min(120, idleDisconnect/2)`s before disconnect; dismissed only by explicit button | |
| Idle disconnect default | 600s (10 min) | |
| Affinity | A user's WS always hits the same node | |
| Grace | No grace on refresh (fresh start); transient blips covered by slot heartbeat staleness window | |
| Cap strictness | **Soft cap** — no distributed lock/atomic-counter exists for extensions, so brief, self-correcting overshoot under simultaneous multi-node admits is accepted | |
| Observability | kSDK `TelemetryMetrics` (OpenTelemetry-backed) | |
| Fail mode | Fail-open everywhere (admit on subsystem error) | |

## 3. Configuration model
### 3.1 Admin-configurable (Integration Settings tab → `uiConfigJson`)
| Key | Default | Meaning |
|-----|---------|---------|
| `concurrencyControlEnabled` | `false` | Master kill switch. Off ⇒ feature inert. |
| `maxConcurrentUsers` | `100` (min 1) | Per-invoker active-user cap. |
| `idleDisconnectSeconds` | `600` (min 30) | Idle time before forced disconnect. |

Idle management is coupled to the master flag (no separate sub-flag). The settings UI is a new "Concurrency & Idle" collapsible section in `src/main/resources/integration/index.html` (master toggle + 2 number inputs, numbers disabled until the toggle is on), saved via the existing `POST /saveUIConfig`.

### 3.2 Internal constants (`concurrency/ConcurrencyConstants.java`)
`QUEUE_POLL_INTERVAL_MS=5000`, `AVG_SESSION_DURATION_SECONDS_SEED=180`, `NETWORK_BLIP_GRACE_SECONDS=15`, `RESERVATION_TTL_SECONDS=10`, `IDLE_WARNING_LEAD_CAP_SECONDS=120`, `REAPER_INTERVAL_MS=5000`, `SLOT_STALE_MS=45000`, `QUEUE_TICKET_STALE_MS=15000`, `QUEUE_SAFETY_CEILING=10000`, plus namespaced KV key prefixes (`__cc_slot__:`, `__cc_queue__:`, `__cc_resv__:`) and metric names.

Derived idle-warning lead = `min(120, idleDisconnectSeconds/2)`. The frontend derives this same value and mirrors `QUEUE_POLL_INTERVAL_MS=5000`, so admins never set it directly. (No `Configuration` DTO change: the 3 keys already pass through `/config`'s `config` map; the FE derives the rest.)

## 4. Backend (all new under `…/omnichatbot/concurrency/`, flag-gated)
| File | Role |
|------|------|
| `ConcurrencyConstants` | Tuning constants, KV prefixes, metric names. |
| `ConcurrencyConfig` | Fail-safe reader of the 3 settings straight from `KeyValueStore` (avoids a DI cycle with `ChatBotExtension`); clamps + derived warning lead; `isEnabled()`→false on any error. |
| `SlotStore` | Per-account slot key `{refcount,lastSeen,firstAcquired}` (multi-tab = 1 slot, freed on last close; heartbeat for reaper) + reservations. Read-modify-write is safe because affinity means only the owning node mutates a given account's key. |
| `QueueStore` | FIFO tickets in KV + per-node read cache. KV is authoritative for pop/idempotency; cache for position/depth display; `rehydrate()` on load + each reaper tick. FIFO by enqueue time (clock-skew accepted — no atomic sequence available). |
| `WaitTimeEstimator` | EMA of engaged session durations (seeded); `estimateWaitMillis = ceil(position*avg/capacity)*1000`. |
| `ConcurrencyManager` | Orchestrator: `requestAdmission` / `checkStatus` (read-only) / `leaveQueue`; WS hooks `onWsOpened/onWsClosed/onWsPing`; promotion on close + in the reaper only (status-poll never races); reaper reclaims leaked slots, expired reservations, abandoned tickets; fail-open; telemetry. Reaper mirrors the `ChatBotPool` virtual-thread sweep pattern. |
| `resource/dto/AdmissionResult` | `{status, position, estimatedWaitMs, pollIntervalMs}`. |
| `resource/AdmissionResource` | `POST /admission/request`, `GET /admission/status`, `POST /admission/leave` (no-store); resolves account from `RuntimeContext`, fails open if absent. Registered in `ChatBotApplication`. |

Capacity = active slots + outstanding reservations. A walk-in is queued whenever the queue is non-empty (FIFO fairness). Reservations hold a slot for an admitted-but-not-yet-connected user and for a promoted queue head; reclaimed by TTL if the WS never opens.

**Wiring:** `WsEventHandlerRegistry` injects `ConcurrencyManager` and passes it to `WsConnectionOpenedHandler` (`onWsOpened` after `connectionStore.put`), `WsConnectionClosedHandler` (`onWsClosed` when accountId present), `WsConnectionPingHandler` (`onWsPing` heartbeat). `ChatBotExtension.onInvokerLoad` calls `rehydrate()`+`start()`; `onInvokerUnload`/`onInvokerRemoved` call `shutdown()`. All hooks no-op when the flag is off.

## 5. Frontend (`src/main/omni-angular`, all new + flag-gated)
| File | Role |
|------|------|
| `services/concurrency-config.service.ts` | Reads the 3 keys from the live config; `isEnabled()`, `idleDisconnectMs()`, derived `idleWarningLeadMs()`, `QUEUE_POLL_INTERVAL_MS`. |
| `services/admission.service.ts` | `gateThenOpen(openFn)`: POST request → if QUEUED, poll `/admission/status` (RxJS timer+switchMap, stops on admit/destroy) and surface `{position, estimatedWaitMs}` (monotonic-smoothed); `leave()` on pagehide/idle; fail-open (opens WS) on request error. |
| `services/idle-activity.service.ts` | Throttled out-of-zone activity listeners; cross-tab via BroadcastChannel keyed by account (activity in any tab resets; disconnect only when all idle); warning at `disconnect-lead`, dismissed only by explicit confirm; on disconnect frees slot + closes WS; fully separate from the 1008 session-timeout. |
| `components/shared/waiting-screen/*` | Queue screen (theme-branded, position + smoothed wait, localized). |
| `components/shared/idle-warning-modal/*` | Live countdown + "I'm still here". |
| `components/shared/inactivity-disconnected/*` | "Disconnected due to inactivity" + reconnect (reuses header restart = `window.location.reload()`). |

**Gate (Faster-Startup-agnostic):** `AppFacade.openWebSocketWhenAttributesSettled()` is the single WS-open chokepoint reached by all three boot paths (pooled, `createSession`, login fallback). When `isEnabled()`, it runs admission then opens on ADMITTED (`onAdmitted()` also starts the idle monitor); when off, it calls `initializeWebSocket()` exactly as before. `admissionState$`/`idleState$` drive the new screens in `app.component`, subscribed only when enabled. i18n keys added under `concurrency.*` to all locale files.

## 6. Edge cases
Refresh = fresh start. Tab close while active → ref-count release; last tab frees slot → promote. Tab close while queued → `leave()` best-effort + ticket staleness prune (~15s). Multi-tab = 1 slot. Network blip → slot retained until heartbeat staleness (`SLOT_STALE_MS`). Admitted-but-no-WS → reservation TTL reclaim. Store failure → fail-open admit. Idle disconnect frees a slot for the next queued user.

## 7. Observability
Via injected `TelemetryMetrics`: gauges `chatbot.concurrency.active` / `.queue_depth`; counters `.admitted` / `.queued` / `.rejected_failopen` / `.idle_disconnect`; durations `.wait_ms` (unused placeholder) / `.session_duration_ms`. Attributes include `invoker_id`.

## 8. Tests
`src/test/.../concurrency/`: `InMemoryKeyValueStore` + `NoOpTelemetryMetrics` helpers; `SlotStoreTest`, `QueueStoreTest`, `WaitTimeEstimatorTest`, `ConcurrencyConfigTest`, `ConcurrencyManagerTest` (admit→cap→queue→promote, multi-tab=1 slot, FIFO fairness walk-in, flag-off no-op, fail-open). Full `gradle test` green; `gradle compileJava buildUI` green.

## 9. Known limitations (by design / platform constraint)
- Soft cap: brief overshoot possible under simultaneous multi-node admits (no distributed lock/atomic counter in the extension platform); self-corrects.
- FIFO ordering uses wall-clock enqueue time (no atomic cluster sequence); cross-node clock skew can slightly reorder near-simultaneous enqueues.
- Wait estimator excludes sessions ≥ idle-disconnect (treated as idle timeouts) to avoid biasing the average toward the ceiling.

---

## 10. Revision — pre-auth, token-based gate (no account for waiting users)

To avoid provisioning a guest account for users who only wait, admission was moved
**before** authentication and re-keyed off a **client queue token** instead of the
Krista `accountId`.

- **Queue token:** the browser mints a UUID once, persisted in `localStorage`
  (`krista_chatbot_queue_token`), reused across polls/refresh. Same browser (incl.
  tabs) = one token = one slot; another browser/incognito = separate.
- **Unauthenticated `/admission/*`:** whitelisted in `ChatBotAuthenticator.isStaticOrPublicPath`
  (callable before any session, like `/config`). Token passed as the `queueToken`
  **query param** (no CORS change). `POST /request` is per-IP rate limited
  (`AdmissionRateLimiter`, X-Forwarded-For, `ADMISSION_REQUESTS_PER_MIN_PER_IP=60`,
  fail-open if IP unknown) → HTTP 429 on breach; `/status` and `/leave` are not limited.
- **Slot keying:** queue/reservation/slot all keyed by the token. The chat WS upgrade
  URL carries `&queueToken=<t>`; `WsConnectionOpenedHandler` reads it and the manager
  keeps a node-local `connectionId→token` map so close/ping resolve the token.
- **Boot order (frontend):** `config` → admission gate (token) → while QUEUED only
  `/admission/status` polls (no pool-entry/login/session/messages/WS) → on ADMITTED →
  pool-entry/login → session → WS (`onAdmitted`). Bootstrap `pool-entry` prefetch is
  gated in `app.module.ts`: non-blocking always; only fires when the flag is OFF.
- **Reservation TTL raised to 30s** so the full post-admission boot completes before
  the reaper could reclaim the slot (the client stops polling once admitted).
- **Disabled path unchanged** (the `forkJoin(config, poolEntry)` flow is preserved
  verbatim). Minor: when disabled, the bootstrap pool-entry prefetch now starts after
  config resolves rather than fully parallel — a negligible delta since config is the
  prefetched long pole.
