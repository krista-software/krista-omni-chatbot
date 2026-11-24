# KR-21047: Concurrent User Rate Limiting + Idle Session Management

## Overview

Gate chatbot login behind a concurrent-user limit. When the maximum number of active users is reached, new users are placed in a FIFO queue and shown a waiting screen. Users in the queue poll the login endpoint at regular intervals until a seat frees up. Idle session management detects inactive users, warns them, and disconnects them to free seats.

---

## Architecture Change

### Before (Hiren's Implementation)
```
Frontend:  config + pool-entry → login → session → attrs → POST /admission/request
           → if QUEUED: poll GET /admission/status → if ADMITTED: open WS

Backend:   3 separate endpoints for admission control (/admission/request, /admission/status, /admission/leave)
           SlotStore (KVS-backed ref-counted slots + reservations)
           QueueStore (KVS-backed FIFO with in-memory cache)
           Gate is AFTER authentication — user gets a session before admission check
```

### After (New Design)
```
Frontend:  config → POST /authn/login → 
           if success: session → attrs → WS (normal flow)
           if code 1001: show waiting screen → poll login again with queueToken at pollInterval

Backend:   Queue check embedded INSIDE login endpoint
           No user resources created until they have a seat
           SlotStore simplified (no reservations, grace period on disconnect)
           QueueStore reused (token-based keys instead of accountId)
           Gate is AT authentication — no wasted account provisioning
```

### Why This Is Better
- No wasted account provisioning for queued users
- No sessions consuming resources while waiting
- Simpler flow, fewer endpoints (remove 3 admission endpoints + 1 pool-entry endpoint)
- Single login endpoint handles everything
- Client just polls login — no separate admission service

---

## Spec Requirements (from Jira ticket)

### 1. Feature Flag Gating
- Admin toggle `concurrencyControlEnabled` in Integration Settings
- When OFF: all queue logic is bypassed, login works exactly as before
- Every backend entry point no-ops when disabled
- Frontend gates on config flag from `/config` endpoint

### 2. Concurrent User Rate Limiting
- **Max concurrent users**: configurable via Integration Settings (default 100, min 1)
- **Tracking**: SlotStore tracks active users by accountId with ref-counting (multi-tab support)
- **Queue**: FIFO queue with long-number tokens for users who can't get a seat
- **Admission**: happens inside login endpoint — no separate admission API

### 3. FIFO Queue
- Token-based: server generates monotonically increasing long numbers
- Token is sent to client in queue error response, client sends it back on polls
- Queue backed by KVS (Infinispan) for cluster-wide consistency + in-memory cache for fast reads
- Stale cleanup: queue entries not polled within ~30s (6x poll interval) are pruned
- Position + estimated wait time returned in queue response

### 4. Waiting Screen
- Shows queue position and estimated wait time
- Bounce-dot animation
- Accessible (ARIA attributes, live region)
- i18n for 9 languages (already implemented)

### 5. Idle Session Management (Phase 1 — kept)
- **Activity tracking**: monitors click, keydown, scroll, mousemove, touchstart (500ms throttle)
- **Cross-tab**: BroadcastChannel for coordination
- **Warning**: modal with countdown, dismissible only by explicit "I'm still here" button
- **Disconnect**: after `idleDisconnectSeconds` (configurable, default 600s, min 30s)
- On disconnect: calls logout → WS closes → seat freed (after grace period)

### 6. Seat Release
- **Trigger**: WS close — BUT with grace period (not immediate)
- **Grace period**: keep slot for ~45-50s after last WS tab closes (equivalent of 5 missed pings)
- **Implementation**: when refcount → 0, don't remove the slot; keep it with refcount=0 and fresh lastSeen. The background reaper frees it after SLOT_STALE_MS (45s) if no reconnection.
- **Reconnection**: if WS reopens for same accountId within grace window, refcount goes back to 1, slot stays alive
- This handles: network instability, page refresh, tab close + quick reopen

### 7. Returning User (Page Refresh)
- **Re-check limit**: even returning users with valid session cookies are checked
- **Active slot bypass**: if the user already has an active slot (including grace period), they bypass the queue — they're already counted as an active user
- **No active slot**: if their slot was freed (grace expired), they must check seat availability and may be queued

### 8. Admin Preview
- Workspace admins loading chatbot from the workspace UI bypass the queue entirely
- Detected by: `runtimeAccountId.equals(authorizedAccountId)`

### 9. Fail-Open Behavior
- Every exception path admits the user (backend + frontend)
- A broken queue should never lock users out of the chatbot
- Frontend request errors also fail open

### 10. Telemetry / Observability
- **Active metrics used**: `chatbot.concurrency.active` (gauge), `chatbot.concurrency.queue_depth` (gauge), `chatbot.concurrency.admitted` (counter), `chatbot.concurrency.queued` (counter), `chatbot.concurrency.rejected_failopen` (counter), `chatbot.concurrency.session_duration_ms` (histogram)
- **Gaps to wire**: `chatbot.concurrency.idle_disconnect` (counter — increment on idle disconnect), `chatbot.concurrency.wait_ms` (counter — record actual queue wait time)

### 11. Multi-Node Cluster
- KVS (Infinispan) is the source of truth — shared across all nodes
- In-memory cache on each node for fast reads (rehydrated on startup + every reaper sweep)
- Queue writes to KVS happen synchronously (already the case in existing QueueStore)
- Active count is based on KVS slot scan — cluster-wide accurate

### 12. Config in Integration Settings
- Three settings in the "Concurrency & Idle" section:
  - `concurrencyControlEnabled` (boolean toggle, default false)
  - `maxConcurrentUsers` (number, default 100, min 1)
  - `idleDisconnectSeconds` (number, default 600, min 30)
- Number inputs disabled when toggle is unchecked
- Clamping via `clampInt()` on save

---

## Data Structure Decision

**Recommendation: Reuse existing KVS-backed QueueStore with token strings as keys**

The existing `QueueStore` uses `String` keys (currently accountId). We repurpose it to use `Long.toString(token)` as the key. This gives us:

- **KVS persistence**: survives extension restart
- **In-memory cache**: fast position reads
- **Stale cleanup**: TTL-based pruning of abandoned tickets
- **FIFO ordering**: by `enqueueMillis` (monotonic, same as token order)
- **Thread safety**: `synchronized` methods

For active user tracking, `SlotStore` already does ref-counted slots in KVS. We just modify it:
- Remove reservation logic (no longer needed)
- Grace period: don't remove slot when refcount → 0

Token generation: `AtomicLong` in `ConcurrencyManager` — monotonically increasing, unique per node. Seeded from KVS on rehydrate to survive restarts.

**Why not binary search / ConcurrentSkipListMap / LinkedHashMap?**
- Queue size will be < 500 in any practical scenario
- O(n) linear scan for position is sub-millisecond at this scale
- KVS persistence is more valuable than microsecond lookup optimization
- Existing QueueStore already works and is tested

---

## Queue Error Response Format

When login returns a queue response (HTTP 429 with body):

```json
{
    "code": 1001,
    "message": "MaxLimitReached",
    "queueToken": 42,
    "queuePosition": 10,
    "estimatedWaitMs": 30000,
    "pollIntervalMs": 5000
}
```

- `code: 1001` — constant, machine-readable error code
- `message: "MaxLimitReached"` — human-readable status
- `queueToken: 42` — long number, client stores and sends back on subsequent polls
- `queuePosition: 10` — 1-based position in FIFO queue
- `estimatedWaitMs: 30000` — estimated wait in milliseconds (Little's Law based)
- `pollIntervalMs: 5000` — how often to retry login (5 seconds)

**HTTP status**: `429 Too Many Requests` — standard rate-limit status code. Includes `Retry-After` header (in seconds). Frontend catches the 429 in login error handler and switches to queue/waiting mode.

---

## Token Delivery Mechanism

- **Direction**: server → client in queue response, client → server in subsequent login polls
- **Field**: optional `queueToken` field in the login POST body (`Map<String, String>` on backend)
- **Format**: long number sent as string from frontend: `{"queueToken": "12345"}`
- **Backend parsing**: `loginInput.get("queueToken")` → parse to Long, null if absent

---

## Login Endpoint Flow (Backend)

```
POST /authn/login (ChatBotAuthResource.java)
│
├─ Compute authorizedAccountId, runtimeAccountId
│
├─ Admin preview? (runtimeAccountId == authorizedAccountId)
│  └─ YES → handleLogin() (old logic, bypass queue entirely)
│
├─ Queue enabled? (concurrencyManager.isEnabled())
│  ├─ NO → handleLogin() (old logic unchanged)
│  └─ YES → handleLoginWithQueue()
│           │
│           ├─ Returning user with active slot?
│           │  (has cookie + valid session + accountId has slot in SlotStore)
│           │  └─ YES → return cached auth response (already counted as active)
│           │
│           ├─ Parse queueToken from request body
│           │
│           ├─ checkLoginAdmission(queueToken)
│           │  ├─ Returns null → ADMITTED → fall through to handleLogin()
│           │  └─ Returns QueuedLoginResponse → QUEUED → return queue error response
│           │
│           └─ [admitted path] → handleLogin() (normal flow)
│
└─ handleLogin() [private, extracted from old login()]
   │
   ├─ Returning-user fast-path (cookie + valid session → cached auth)
   ├─ Pool check (popPoolEntryAsResponse — pool-entry merged here)
   └─ Fresh guest provisioning (provisionGuestSession)
```

---

## ConcurrencyManager.checkLoginAdmission() Logic

```java
synchronized QueuedLoginResponse checkLoginAdmission(Long queueToken) {
    if (!config.isEnabled()) return null;  // fail open
    try {
        // Returning queued user (has token from previous call)
        if (queueToken != null && queueStore.contains(tokenKey)) {
            queueStore.touch(tokenKey, now);  // refresh heartbeat
            if (hasRoom()) {
                queueStore.pruneStale();  // clean dead entries ahead
                String head = queueStore.peekHead();
                if (head != null && head.equals(tokenKey)) {
                    queueStore.remove(tokenKey);
                    return null;  // ADMITTED — they're at the head
                }
            }
            // Not at head or no room — stay queued
            return QueuedLoginResponse(queueToken, position, waitMs, pollIntervalMs);
        }

        // New user (no token)
        if (hasRoom() && queueStore.depth() == 0) {
            return null;  // ADMITTED — seats free, queue empty
        }

        // Must queue — generate token and enqueue
        long newToken = tokenGenerator.incrementAndGet();
        queueStore.enqueue(newTokenKey, now);
        return QueuedLoginResponse(newToken, position, waitMs, pollIntervalMs);
    } catch (Exception cause) {
        return null;  // FAIL OPEN — always admit on error
    }
}
```

**FIFO enforcement**: only the queue head can be admitted when a seat frees up. Users behind the head must wait even if seats are technically available (a seat was just freed and the head hasn't polled yet). The reaper prunes stale entries ahead in the queue so a dead head doesn't block forever.

---

## Slot Grace Period (Network Blip Handling)

### Problem
User's WS drops due to network instability. If the slot is freed immediately, they lose their seat and must re-queue.

### Solution
When the last WS tab closes (refcount → 0):
1. **Don't remove the slot** from SlotStore
2. **Set refcount = 0, lastSeen = now** — grace window starts
3. Slot still counts against capacity (held seat)
4. **If user reconnects within ~45s**: WS opens → refcount → 1 → slot stays alive
5. **If no reconnect within ~45s**: reaper sees stale slot → removes → seat freed for queue

### Implementation (SlotStore.releaseConnection)
```java
public int releaseConnection(String accountId, long nowMillis) {
    SlotEntry existing = readSlot(accountId);
    if (existing == null) return 0;
    int refcount = existing.refcount() - 1;
    if (refcount <= 0) {
        // Grace period: keep slot with refcount=0, update lastSeen
        // Reaper will clean it up after SLOT_STALE_MS if no reconnect
        store.put(slotKey(accountId), encode(0, nowMillis, existing.firstAcquired()));
        return 0;
    }
    store.put(slotKey(accountId), encode(refcount, nowMillis, existing.firstAcquired()));
    return refcount;
}
```

### ConcurrencyManager.onWsClosed changes
When `releaseConnection` returns 0, **don't promote the queue** — the seat is still held during grace. The reaper handles promotion after grace expiry.

### Timing
- `SLOT_STALE_MS = 45000` (45s) — existing constant, covers ~5 missed pings at ~10s intervals
- Reaper runs every 5s (`REAPER_INTERVAL_MS = 5000`)
- Worst case: seat held for up to 50s (45s stale + 5s reaper interval)

---

## Pool-Entry Endpoint Removal

### Current State
- `GET /authn/pool-entry` — standalone endpoint for cached SPAs
- `POST /authn/login` — calls `popPoolEntryAsResponse()` internally at line 101

### Change
- **Remove** the standalone `GET /authn/pool-entry` endpoint entirely
- Login already handles pool entries internally via `popPoolEntryAsResponse()`
- Frontend stops calling `getPoolEntry()` — always goes through login

### Regression Check
- The `GET /pool-entry` endpoint was only called from `AuthApiService.getPoolEntry()`
- That was called from `AppFacade.initializeAPIs()` via forkJoin
- After removal, the frontend always calls login (which checks pool internally)
- Pool users still work — they're served via `popPoolEntryAsResponse()` inside login

---

## Frontend Flow Change

### Before (with admission gate)
```
AppFacade.initializeAPIs():
  forkJoin({ config: getConfig(), pool: getPoolEntry() })
  → if pool has auth data: handleAuthenticationSuccess(pool)
  → else: fallbackToLogin() → performLogin()

After auth success:
  initializeSessionAndMessages(pooledInboxId?)
  → openWebSocketWhenAttributesSettled()
    → if concurrency enabled:
        admissionService.gateThenOpen(() => initializeWebSocket())
        → POST /admission/request → poll /admission/status → ADMITTED → open WS
    → else:
        initializeWebSocket()
```

### After (queue-gated login)
```
AppFacade.initializeAPIs():
  config$ → handleConfigLoaded()
  → performLogin() (always, no pool-entry call)

performLogin():
  POST /authn/login (with optional queueToken in body)
  → if response has accountId: handleAuthenticationSuccess(authData)
  → if response has code 1001: show waiting screen, store queueToken, start polling

Polling:
  timer(pollIntervalMs) → POST /authn/login({ queueToken: storedToken })
  → if accountId present: admitted → handleAuthenticationSuccess → session → WS
  → if code 1001: update position + wait time on waiting screen

After auth success:
  initializeSessionAndMessages()
  → openWebSocketWhenAttributesSettled()
    → initializeWebSocket() (no admission gate — already admitted via login)
    → if concurrency enabled: start IdleActivityService
```

---

## Files to Modify

### Backend — Create New
| File | Purpose |
|------|---------|
| `resource/dto/QueuedLoginResponse.java` | Queue error response DTO |

### Backend — Modify
| File | Changes |
|------|---------|
| `ConcurrencyManager.java` | Remove admission API methods. Add `checkLoginAdmission()`, `hasActiveSeat()`, `isEnabled()`. Add `AtomicLong tokenGenerator`. Modify `onWsClosed()` (no promote on grace). Modify `sweep()` (promote after reclaim). |
| `SlotStore.java` | Modify `releaseConnection()` — grace period (don't remove slot when refcount→0). Remove reservation methods. |
| `QueueStore.java` | Add `peekHead()` method (peek without removing). |
| `ConcurrencyConstants.java` | Remove reservation constants. Keep `QUEUE_POLL_INTERVAL_MS`, `SLOT_STALE_MS`, etc. |
| `ChatBotAuthResource.java` | Remove `GET /authn/pool-entry` endpoint. Extract `handleLogin()`. Add `handleLoginWithQueue()`. Route login through queue when enabled. |
| `ChatBotExtension.java` | Add `getConcurrencyManager()` getter. |
| `WaitTimeEstimator.java` | No changes. |
| `ConcurrencyConfig.java` | No changes. |
| `WsConnectionOpenedHandler.java` | No changes (onWsOpened still works). |
| `WsConnectionClosedHandler.java` | No changes (onWsClosed still works). |
| `WsConnectionPingHandler.java` | No changes (onWsPing still works). |
| `WsEventHandlerRegistry.java` | No changes. |

### Backend — Remove
| File | Reason |
|------|--------|
| `resource/AdmissionResource.java` | All 3 admission endpoints removed. Login handles everything. |
| `resource/dto/AdmissionResult.java` | Replaced by QueuedLoginResponse. |

### Frontend — Modify
| File | Changes |
|------|---------|
| `auth-api.service.ts` | Remove `getPoolEntry()`, `prefetchPoolEntry()`, `startPoolFetchIfNeeded()`, `PoolEntryResponse` type. Login stays. |
| `admission.service.ts` | Refactor: remove `/admission/request`, `/admission/status`, `/admission/leave` calls. Poll via login endpoint instead. |
| `app.facade.ts` | Remove `poolEntry$` from forkJoin. Remove admission gate at WS open. Handle queue response from login. |
| `app.component.ts` | Minimal changes — template helpers still work. |
| `app.component.html` | No changes — waiting screen / idle warning / chat UI routing unchanged. |
| `environment.ts` | Remove `poolEntry` endpoint. |
| `environment.prod.ts` | Remove `poolEntry` endpoint. Add `login` endpoint. |
| `idle-activity.service.ts` | No changes. |
| `concurrency-config.service.ts` | No changes. |

### Frontend — Keep (no changes)
| File | Reason |
|------|--------|
| `waiting-screen.component.ts/html/css` | Shows queue position — reused as-is |
| `idle-warning-modal.component.ts/html/css` | Shows idle countdown — reused as-is |
| `inactivity-disconnected.component.ts/html/css` | Shows reconnect/close — reused as-is |

### Settings UI — Keep (no changes)
| File | Reason |
|------|--------|
| `integration/index.html` | Admin config section unchanged |

### Tests — To Update
| File | Changes |
|------|---------|
| `ConcurrencyManagerTest.java` | Update tests for new `checkLoginAdmission()` method. Remove tests for old admission methods. |
| `ConcurrencyConfigTest.java` | No changes. |
| `QueueStoreTest.java` | Add test for `peekHead()`. |
| `SlotStoreTest.java` | Update tests for grace period behavior. |
| `WaitTimeEstimatorTest.java` | No changes. |

---

## Integration Settings UI (Existing)

The admin configures 3 settings under "Concurrency & Idle":

```
☑ Enable Concurrent User Limit

Max Concurrent Users:     [100]
Idle Disconnect (seconds): [600]
```

- Toggle enables/disables all queue and idle logic
- Number inputs disabled when toggle is unchecked
- Saved to `uiConfigJson` in KeyValueStore
- Read by `ConcurrencyConfig.java` on every call (direct KVS read, no caching)

---

## Edge Cases

### 1. Page Refresh
- Old WS closes → refcount → 0 → slot in grace (45s)
- Page reloads → login request → returning user with cookie
- Login checks: active slot exists? YES (grace slot) → return cached session
- WS opens → refcount → 1 → slot back to active
- **Result**: user never sees queue, seamless refresh

### 2. Tab Close (Intentional Leave)
- WS closes → refcount → 0 → slot in grace
- No reconnect within 45s → reaper removes slot → seat freed
- Queue head (if any) gets admitted on next poll
- **Result**: seat freed after grace period, queue advances

### 3. Network Drop (Transient)
- WS drops → refcount → 0 → slot in grace
- Browser auto-reconnects or user refreshes within 45s
- New WS opens → refcount → 1 → slot stays alive
- **Result**: user keeps their seat

### 4. Network Drop (Permanent)
- WS drops → refcount → 0 → slot in grace
- No reconnect → after 45s reaper frees slot
- **Result**: seat freed, queue advances

### 5. Multiple Tabs (Same User)
- Tab 1: login → WS opens → refcount = 1
- Tab 2: login → WS opens → refcount = 2 (same accountId)
- Tab 1 closes: refcount = 1 (slot stays)
- Tab 2 closes: refcount = 0 (grace starts)
- Counts as 1 concurrent user throughout

### 6. User Closes Tab While in Queue
- Queue token stays in KVS
- No more polls → lastSeen becomes stale
- After ~30s (QUEUE_TICKET_STALE_MS × 2 = 30s), reaper prunes the ticket
- Queue position updates for users behind them

### 7. Admin Saves Config While Users Are Active
- Lowering maxConcurrentUsers: existing users keep their seats, but no new users admitted until count drops below new limit
- Raising maxConcurrentUsers: immediately more seats available, queue heads admitted on next poll
- Disabling toggle: all queue checks become no-ops, login works normally
- Enabling toggle: next login request enters queue logic

### 8. Extension Restart
- SlotStore and QueueStore are KVS-backed — survive restart
- On restart: `rehydrate()` rebuilds in-memory queue cache from KVS
- `tokenGenerator` re-seeded from highest existing queue token (or starts fresh)
- Active slots remain valid — WS reconnections will resume them

### 9. Queue User Opens Multiple Tabs
- Tab 1: login → queued → token 42
- Tab 2: login → no token → gets NEW token 43 (separate queue entry)
- Both tabs poll independently
- When token 42 is admitted, tab 1 proceeds. Tab 2 still waiting (token 43).
- **Mitigation**: client stores queueToken in sessionStorage so all tabs share the same token. Or use localStorage for cross-tab sharing.

### 10. Fail-Open
- KVS down: `checkLoginAdmission()` catches exception → returns null → admits user
- Frontend request error: fails open → proceeds with normal flow
- Queue poisoned: reaper prunes stale entries; worst case, stale entries block the head temporarily (pruneStale runs before head check)

---

## Wait Time Estimation

Uses Little's Law (already implemented in `WaitTimeEstimator`):

```
admissionRate = maxConcurrentUsers / avgSessionDuration
estimatedWait = queuePosition / admissionRate
             = queuePosition * avgSessionDuration / maxConcurrentUsers
```

- `avgSessionDuration`: exponential moving average (EMA, alpha=0.2) of completed, engaged session durations
- Seeded with 180s until enough real samples exist
- Idle-timeout disconnections excluded from the average (they'd bias toward the idle ceiling)
- Implausible samples filtered (< 1s or > 6h)
- Stored in KVS for cross-node consistency

---

## Background Reaper

Virtual thread running every 5s (`REAPER_INTERVAL_MS`). Per sweep:

1. `rehydrate()` — rebuild queue cache from KVS
2. `reclaimLeakedSlots()` — free slots with stale heartbeat (> SLOT_STALE_MS = 45s)
   - Covers: grace period expired, node crash, WS stuck
3. `pruneStale()` — remove queue tickets not polled within QUEUE_TICKET_STALE_MS (15s)
4. `promote()` — NOT done by reaper in new design (admission happens at login poll time)
5. `observeGauges()` — update telemetry

**Key change from old design**: the reaper no longer promotes queue heads. Promotion happens when a queued user polls login and they're at the head with room available. The reaper only cleans up stale entries and frees grace-period slots.

---

## Phase Plan

### Phase 1 (This PR)
- Queue-gated login
- FIFO queue with KVS persistence + in-memory cache
- Grace period on WS disconnect
- Idle session management (client-side)
- Integration Settings UI
- Waiting screen, idle warning, inactivity-disconnected UI
- Feature flag gating
- Fail-open behavior
- Telemetry (wire remaining 2 dead counters)
- Remove admission endpoints + pool-entry endpoint

### Phase 2 (Future)
- Server-side idle enforcement (track last-user-message timestamp, reaper checks against idleDisconnectSeconds)
- Queue token cross-tab sharing (localStorage or BroadcastChannel)
- Frontend unit tests for admission/idle services
- Config endpoint cache-busting for toggle changes
- Rate limiting on queue poll requests
