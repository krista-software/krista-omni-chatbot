# Omni-Chatbot Load Test — Handoff / Findings

Context for the concurrent-login/session work and the residual capacity ceilings still open
after it. Environment: QA (`extension.qa-in.eng.krista.app`), 1000 users / 500 concurrent.

## What was fixed (shipped)

1. **Pool consumption regression (KR-21047).** `GET /authn/pool-entry` was removed, leaving the
   pool's only consumer behind a `handleLogin` gate a fresh guest could never satisfy (a fresh
   login authenticates AS the invoker's runtime account, so `authorizedAccountId == runtimeAccountId`).
   The pool warmed ~1000 entries that were never popped → every login did slow synchronous guest
   provisioning → mass 504s. **Fix:** `handleLogin` now attempts the pool for all non-runtime callers.

2. **Single-call login.** Every login path (pool / fresh / returning) now folds the real OmniChannel
   session inbox (`inbox_S_…`) + `extras.sessionReady` into the login response, so the SPA opens the
   WebSocket with it and **skips `POST /session`**. `POST /session` retained for back-compat.
   This removed a per-user JMS round-trip and the session-creation 504 wall.

## Result trend

| Run | Flow | Auth success | Notes |
|-----|------|--------------|-------|
| test-8 | 2-call (old gate) | 77.7% | login+session both pinned ~30s |
| test-9 | 2-call (assets fetched once) | 70.0% | session `504` wall (212) exposed once client-bandwidth noise removed |
| **test-10** | **1-call (session folded into login)** | **87.9%** | **session call eliminated (0 failures)** |

## Residual ceilings still open (NOT fixed by the above — owner: infra / backend capacity)

### 1. Login `504`s under burst — pool drain vs refill
- test-10: 121 login failures, all `504`; login p90/p95 pinned at 30s.
- **Cause:** a pool **hit** login is sub-second (pre-warmed inbox, no JMS). A pool **miss** login now
  does `provisionGuestSession` **+** the folded `getOrCreateSession` JMS inline → heavy → 30s. At
  500-concurrent the pool **drains faster than it refills** (each refill is a JMS account+session
  create), so later users fall to the heavy fresh path.
- **Levers (infra/backend):** larger pool / faster refill so it doesn't drain under burst; faster
  fresh provisioning; more EP capacity for the burst. Total work is unchanged — it's a fresh-path
  server-capacity limit, not the test/script/architecture.

### 2. Conversation-engine saturation (separate subsystem, downstream of auth)
- test-10: WebSocket **established 84.9%**, but **conversation reached only 16.6%**; Bot Reply 1
  avg **~48s**. Of ~849 connected users, ~683 got **0 bot messages** in the window.
- **Cause:** on WS open the server auto-triggers the **welcome conversation**, processed by the
  OmniChannel conversation engine / appliance. Under ~849 concurrent WebSockets that engine
  saturates, so most connected users were still waiting when the test ended.
- **This is not the login/session path** — auth/WS is healthy. It's a separate message/welcome
  processing capacity wall worth its own investigation (conversation engine / appliance throughput).

## How to read pool-vs-fresh in the report (test-10 harness)

The login response now includes `extras.servedFrom` = `pool` | `fresh` | `returning`. The test
records it and `summary.txt` prints the REAL split:
```
Auth source: pool=X  fresh=Y  returning=Z  unknown=N
```
(The old `Auth path: pool/fallback` line was a stale test-script artifact — always `fallback` —
and has been replaced.) Server-log cross-check (SigNoz), correlated by `accountId`:
- pool → `#####-CHATBOT POOL user fetched from pool … remainingPoolSize=N`
- fresh → `#####-CHATBOT LOGIN new guest session created (not from pool)`

## Test harness notes
- `websocket_chatbot_test.py`: prefetches the UI bundle ONCE (CDN + browser-cached in reality, so
  per-user re-download only saturates the client machine); per-user boot = `config → login →
  (session only if no sessionReady) → WS`.
- Run from more than one machine (or lower concurrency) to remove the single-client bottleneck when
  measuring server capacity.
