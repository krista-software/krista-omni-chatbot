# Omni SDK — Cross-Invoker Session-Timeout Contamination (RCA + Fix Specification)

**Date:** 2026-07-16
**Reported by:** Omni-Chatbot team (QA reproduction, `qa-in.eng.krista.app`, node1-extension-proxy)
**Affected component:** `krista-service-apis-java` → `omni_sdk` (`SessionTimeoutMonitor`, `spi/impl/store/SessionStore`, `OmniChannelServiceImpl`)
**Severity:** High — wrong session-timeout enforcement + guaranteed loss of session-timeout messages whenever more than one omni-channel (chatbot) invoker runs in the same extension-proxy JVM.

---

## 1. Executive summary

When two or more chatbot invokers are hosted in the same extension-proxy JVM, the omni SDK's
session-timeout bookkeeping is **shared between them instead of being scoped per invoker**. Every
invoker's `SessionTimeoutMonitor` sweeps **all** chatbot sessions on the node and applies **its own
invoker's Session Timeout attribute** to each of them. Consequences:

1. **The effective session timeout for every chatbot on the node is the MINIMUM timeout configured
   across all chatbot invokers.** (Proven: a session on an invoker configured with 20 minutes was
   expired after ~13 minutes of idle by a neighbor invoker configured with 1 minute.)
2. **When a "foreign" monitor expires a session, the session-timeout message is silently lost**,
   because the delivery pipeline runs in the foreign invoker's extension context (foreign
   classloader → empty node-local connection store, foreign producer, foreign attributes). The
   user's account is still deleted.
3. The user is left with an apparently healthy chat that never responds again (mitigated in
   omni-chatbot ≥ 3.0.7 by a client-side fallback, but the real message is still lost).

---

## 2. Reproduction environment

- Node: `node1-extension-proxy` (single JVM)
- Invoker A (ours): `INV_3a6f6306-f3cc-4ffb-8454-00a2e6cf37fe`, Session Timeout = **20** minutes
- Invoker B (neighbor): `INV_9892177b-6d40-4399-9b80-1818c3662cca`, Session Timeout = **1** minute
- One monitor thread per invoker confirmed via `jstack` (no orphaned monitors):
  - Thread `1687` = monitor of Invoker A
  - Thread `1029` = monitor of Invoker B

## 3. Evidence timeline (SigNoz log export, 2026-07-16)

| Time (IST) | Event | Source |
|---|---|---|
| 14:24:24.737 | `#####-CHATBOT LOGIN new guest session created (not from pool), accountId=wsContact_ee335ab5-…` | Invoker A login |
| 14:24:25 | WS opened + authorized, welcome conversation runs; session inbox `inbox_S_901d1171-2ae3-4d90-a9d4-0ee1d9023c96` | Invoker A |
| 14:24:35 → 14:37:09 | Authenticated pings every 10 s (user idle, no user messages) | Invoker A |
| 14:30:22.758 | `MONITOR RUNNING… Thread ID = 1687` — **Invoker A's own monitor sweeps: session idle ~6 min < 20 min → correctly NOT expired** | Invoker A monitor |
| 14:37:15.054 | `MONITOR RUNNING… Thread ID = 1029` — **Invoker B's monitor sweeps** (1,341 `[SESSION TIMEOUT LIVE INV_9892177b…] Session not timed out…` lines) | Invoker B monitor |
| 14:37:16.390 | `inboxId id : inbox_S_901d1171-…` + `Request Payload: {Transcript=, SessionId=inbox_S_901d1171-…}` — **Invoker B's sweep processes Invoker A's session** (idle ~12.8 min > B's 1-minute timeout → expired) | Invoker B monitor |
| 14:37:16.919 | `#####-CHATBOT- NO WEBSOCKET CONNECTION FOUND FOR ACCOUNT ID: wsContact_ee335ab5-…` — **timeout-message delivery dropped**: it executed inside Invoker B's extension context, whose node-local `WsConnectionStore` (static, per-classloader) has no entry for Invoker A's connection | Invoker B context |
| 14:37:16.936 | `#####-SCHEDULING ACCOUNT DELETION ASYNCHRONOUSLY. ACCOUNT ID = wsContact_ee335ab5-…` | Invoker B context |
| 14:37:27.087 | `#####-ACCOUNT DELETED SUCCESSFULLY…` — **user deleted after 13 minutes despite Invoker A's 20-minute timeout; timeout message never delivered** | |

Key contrast: Invoker A's own monitor evaluated the same session at 14:30 and correctly kept it
alive. Nine minutes of remaining lifetime were stolen by Invoker B's monitor applying B's 1-minute
timeout. The ~13-minute observed lifetime = login (14:24) → B's next 15-minute sweep tick (14:37).

## 4. Root cause (code)

### 4.1 Shared bookkeeping store

`omni_sdk/impl/src/main/java/app/krista/omni/sdk/spi/impl/store/SessionStore.java`:

```java
public static SessionStore create(ServiceRegistry serviceRegistry) {
    RequestContext requestContext = ThreadLocalProxy.getThreadLocal(RequestContext.class).get();
    return new SessionStore(
        serviceRegistry.lookupService(KeyValueStore.class, requestContext.getExecutionMode()), …);
}
…
private final String SESSION_KEY = "Session_Timeout_key";   // ← one flat key, no invoker scoping
```

- The `KeyValueStore` is resolved **by execution mode only** — there is no invoker dimension in the
  lookup or in the `Session_Timeout_key` list key.
- In a multi-invoker extension-proxy JVM this resolves to a store that is effectively shared across
  the co-hosted omni invokers (empirically proven above: Invoker B's monitor read Invoker A's
  session keys out of `getSessionKeyForTimeout()`).

### 4.2 Monitor applies its own invoker's timeout to every session in the list

`omni_sdk/impl/src/main/java/app/krista/omni/sdk/spi/impl/monitor/SessionTimeoutMonitor.java`
(`checkForSessionTimeout`, lines ~87–115):

```java
sessionKeyForTimeout = sessionStore.getSessionKeyForTimeout();       // shared list (4.1)
…
sessionTimeout = (Double) invokerForSessionTimeout.getAttributes()
        .get(CommonInvokerParameters.SESSION_TIMEOUT);               // THIS invoker's timeout
for (String sessionKey : sessionKeyForTimeout) {
    …
    String executionId = omniChannelService.sendChannelMessageForEndSession(sessionKey, sessionTimeout);
    // ← foreign sessions evaluated with the wrong timeout
```

There is **no ownership check**: the monitor cannot even determine ownership, because
`OmniChannelSession` carries no `invokerId` field and the `SH_…` session key is a hash
(`SessionKeyGenerator.generate(accountId, invokerId, mode)`) that cannot be decoded.

### 4.3 Why the timeout message is lost when a foreign monitor expires a session

`OmniChannelServiceImpl.executeDefaultMessage → cleanupAfterTimeout` runs on the foreign monitor's
thread, inside the **foreign invoker's extension context/classloader**:

- The medium extension's node-local connection state (e.g. the chatbot's static
  `WsConnectionStore`) belongs to the owning invoker's classloader → lookups return null →
  `NO WEBSOCKET CONNECTION FOUND` → message dropped (observed at 14:37:16.919).
- Even without that guard, the registered `MediumMessageSender`, ActiveMQ producer, distributed
  store namespaces and fallback-conversation attributes would all be the foreign invoker's.
- `scheduleAccountDeletionAsync` still runs → **account deleted, message lost — silent data loss.**

## 5. Required fix (SDK)

### 5.1 Primary: scope the timeout bookkeeping per invoker

In `spi/impl/store/SessionStore`:

```java
// replace the flat constant with an invoker+mode-scoped key
private String sessionTimeoutListKey() {
    RequestContext ctx = ThreadLocalProxy.getThreadLocal(RequestContext.class).get();
    return "Session_Timeout_key_" + ctx.getInvokerId() + "_" + ctx.getExecutionMode();
}
```

Apply to `storeSessionKeyForTimeout`, `getSessionKeyForTimeout`, `deleteSessionKeyForTimeout`.
(If the `RequestContext` is not reliably present on all call paths, pass the invoker id into
`SessionStore.create(...)` explicitly — the monitor already holds its `Invoker`.)

### 5.2 Defensive: make ownership explicit

Add `invokerId` to `OmniChannelSession` (set at session creation in
`OmniChannelSessionManager`). In `SessionTimeoutMonitor.checkForSessionTimeout`, skip sessions
whose `invokerId` does not match the monitor's invoker. This protects against any future shared
store and makes the invariant self-documenting. (Sessions persisted before the upgrade have no
`invokerId` — treat `null` as "owned" during the migration window, or resolve via 5.3.)

### 5.3 Migration of the legacy shared list

On first sweep after upgrade, the monitor will read the legacy `Session_Timeout_key` list.
Recommended: for each legacy key, regenerate the expected key via
`SessionKeyGenerator.generate(session's accountId, thisInvokerId, mode)`-comparison or the new
`invokerId` field; move owned entries into the scoped list; leave the rest for their owners; delete
the legacy key when empty. A simpler acceptable alternative: keep reading the legacy list for N
releases but only ACT on owned sessions (5.2).

### 5.4 Do not delete accounts when delivery context is foreign

Belt-and-braces: `executeDefaultMessage` should verify the session belongs to the current invoker
before `cleanupAfterTimeout`/`scheduleAccountDeletionAsync`. Expiring and deleting in a foreign
context is never valid.

## 6. Acceptance test plan

1. **Isolation test:** two omni invokers in one extension-proxy JVM, timeouts 1 min and 20 min.
   Create one idle session on each. Assert: the 20-min session survives every 1-min invoker sweep
   and is expired only by its own monitor after ≥ 20 min idle; the 1-min session expires in ~1–16
   min (sweep granularity).
2. **Delivery test:** for the expired session, assert the timeout message (with
   `isSessionTimeout=true`) is delivered over the owning invoker's medium (chatbot: published to
   `websocket-chatbot-messages` with the session's real connectionId), THEN account deletion.
3. **Migration test:** seed a legacy flat `Session_Timeout_key` list containing sessions of both
   invokers; assert each is expired only by its owner post-upgrade.
4. **Regression:** existing `SessionTimeoutMonitorTest` +
   omni-chatbot k6 harness (`../loadtest/session-timeout-load.js`) with 50 sessions.

## 7. Workarounds until the SDK fix ships

1. Configure the **same Session Timeout on all chatbot invokers** sharing an extension proxy
   (removes the wrong-duration symptom; the message-loss symptom remains possible since a foreign
   monitor can still win the sweep race).
2. Omni-chatbot extension ≥ 3.0.7 contains a client-facing mitigation: connections of deleted
   accounts are closed on their next ping, which triggers the frontend's session-timeout fallback
   notice — so the end user is always informed even when the real message is lost.

## 8. Related observations for the SDK team

- `SessionTimeoutMonitor.run()` catches `Exception` with `System.err.println` — should use the
  logger.
- `checkForSessionTimeout` line 99 casts the attribute with `(Double)` — a non-Double value breaks
  the whole sweep.
- The 15-minute sweep interval is hardcoded; the timeout granularity is therefore ±15 min, worth
  documenting for admins ("Session Timeout = T means expiry between T and T+15 minutes of idle").
