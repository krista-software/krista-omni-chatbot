# Session-Timeout Message Delivery Fixes (KR-21024) — Review Guide

## Problem

On session timeout, the guest account was deleted but the **"Session timed out. Please
refresh to start again."** message often never reached the chat user. The failure was
intermittent — the happy path always worked — which is why it survived in production.

Investigation on QA (invoker `INV_3a6f6306`, routing `_sDA_pw…`) found **three independent
server-side bugs**, each capable of silently dropping the message while the account
deletion still proceeded, plus one frontend bug that corrupted the fallback UX, plus two
**operational** findings that are deployment requirements (not code).

## Context: how the timeout message is delivered

```
SDK SessionTimeoutMonitor (background daemon, 15-min sweep)
  └─ executeDefaultMessage → cleanupAfterTimeout → sender.sendChannelMessage(isSessionTimeout=true)
       └─ ChatBotMessageSender.sendMessages            (extension — this changeset)
            └─ ActiveMQProducer → topic "websocket-chatbot-messages"   (extension — this changeset)
                 └─ platform NettyWsRequestHandler consumes on EVERY node,
                    delivers to the node whose sessions map owns the payload connectionId
```

Delivery is **distributed by design**: the publisher does not need to hold the socket —
the platform routes by `connectionId`. Two of the three bugs violated exactly that.

---

## Fix 1 — `ActiveMQProducer.java`: self-healing, thread-safe JMS producer

**Evidence (QA, Jun 24 11:23):** `javax.jms.IllegalStateException: Session is closed` at
`ActiveMQSession.createTextMessage` → send swallowed → message dropped, user deleted.

**Root cause:** a singleton JMS `Connection/Session/MessageProducer` created once at
extension load with **no recovery** — one broker failover/idle-close breaks every later
send forever. The single `Session` was also shared by request threads **and** the monitor
thread (JMS sessions are not thread-safe).

**Change:**
- Producer now stores `storageProvider` + `clientId` and can rebuild its JMS resources
  (`ensureOpen()` / `recreate()` / `closeQuietly()`).
- `sendMessage()` is `synchronized`; on **any** `JMSException` it recreates the
  connection and retries **once** (second failure propagates — no loops).
- `volatile boolean closed` set by `close()`: a **deliberately closed** producer refuses
  to send and is never resurrected — prevents connection leaks when an orphaned monitor
  thread (see Ops-2) calls into a shut-down instance.

**Regression analysis:** happy path is the same single send plus a short mandatory lock;
`close()` keeps `throws JMSException` so caller catch blocks stay valid.

---

## Fix 2 — `ChatBotMessageSender.sendMessages`: publish via distributed connection id

**Evidence (QA, Jun 24 / Jul 2 / Jul 3):** `NO WEBSOCKET CONNECTION FOUND FOR ACCOUNT ID`
logged while the same account's socket was **alive and pinging** — message dropped before
publish, user deleted.

**Root cause:** the method gated publishing on the **node-local** `WsConnectionStore`
(a static, per-classloader map). That map is empty for a perfectly live socket whenever:
- the monitor sweep runs on a **different node** than the socket (multi-node proxy),
- the extension was **reloaded/upgraded** since the socket opened (new classloader), or
- a **different invoker's** instance processes the session (see Ops-1).

The local socket handle was only ever used as a guard — actual delivery has always been
ActiveMQ + connectionId routing.

**Change:** removed the node-local guard and `isClosed()` early-returns. The method now
gates on the **distributed** stores only — `sessionStore.get` (inboxId) and
`connectionStore.get` (connectionId) — then publishes. A dead/stale connectionId is a
harmless platform no-op ("does not belong to this server" on each node).

**Regression analysis:** on the happy path (publisher on the owning node) the publish and
delivery are identical to before. Removed unused `WsConnection` import.

---

## Fix 3 — `ConnectionStore.java`: key namespacing (`chatbot-connection-` prefix)

**Evidence (QA, Jul 2 13:49):** message was published, but the payload carried
`connectionId = a_wsContact_<accountId>` — not a Netty id — so every node logged
`does not belongs to this server` and the message was dropped.

**Root cause:** the per-invoker `KeyValueStore` is **shared** by multiple components.
`ConnectionStore` keyed entries by the **bare accountId**; the SDK `AccountStore` writes
`store.put(accountId, "a_"+userIdentifier)` under the **same key**, clobbering the
connection id. Every other consumer of this store already namespaces its keys
(`SessionStoreImpl` → `chatbot-session-`, `PoolStore`, concurrency → `__cc_slot__:`), and
`ConcurrencyConstants` explicitly documents ConnectionStore's bare keys as the hazard.
`ConnectionStore` was the lone unprefixed writer.

**Change:**
- All keys go through `toKey()` = `"chatbot-connection-" + accountId` (put/get/delete).
- `get()` is null-safe (previously `String.valueOf(...)` returned the **string** `"null"`
  for a missing key, so the null-guard downstream could never fire).
- `deleteAll()` is scoped to the prefix (previously it wiped **every** key in the shared
  store, including other components' data).

**Rollout note:** sessions opened on the *previous* build stored bare-key connection ids;
the new build reads prefixed keys. The upgrade drops sockets anyway and reconnects write
prefixed keys, so the exposure is a single transition window whose worst case equals the
old behavior (a clean `NO CONNECTION ID FOUND` drop). **All chatbot invokers sharing a
workspace must run the same build** (see Ops-1) to avoid a mixed bare/prefixed state.

---

## Fix 4 (frontend) — suppress the duplicate synthetic timeout bubble

Files: `chat.facade.ts`, `client-api.service.ts`, `websocket-handler.service.ts`

The frontend injects a synthetic timeout message on a `1008` WS close as an
**offline-only fallback** (for clients that missed the real message while disconnected).
When the real backend message *was* received, a later `1008` close injected a duplicate
bubble stamped with the local `Date.now()` (wrong time). The facade now calls
`clientApiService.markSessionTimedOut()` when the real message arrives, so the handler's
`sessionTimedOut` guard skips the injection. The offline fallback is unchanged.

---

## Tests & verification assets

| Asset | What it proves |
|---|---|
| `ActiveMQProducerTest` (4 tests, Mockito JMS + real fake StorageProvider) | happy send / recreate-and-retry-once / no resurrection after close / 50 concurrent senders serialized |
| `ActiveMQProducerIntegrationTest` (4 tests, **real embedded Artemis broker**) | real topic delivery / real self-heal after connection kill / closed-producer delivers nothing / 50 concurrent real senders, zero loss |
| `loadtest/session-timeout-load.js` + `README.md` (k6) | end-to-end 50-user acceptance: every VU must receive the real `isSessionTimeout` message (`session_timeout_delivery_rate == 1.0`) |
| `build.gradle`: `artemis-server` / `artemis-jms-client` **testImplementation** | embedded-broker tests only — **not** packaged into the daz (jar packs `runtimeClasspath`) |

Full suite at time of writing: **163 tests, 0 failures / 0 errors / 0 skipped.**

---

## Operational requirements (NOT code — required for the fixes to be observable)

1. **Ops-1 — deploy to ALL chatbot invokers in a workspace together.** Multiple installs
   of this extension share the SDK session store, so *any* invoker's monitor can process
   (and delete!) another invoker's users. A stale-build invoker will keep dropping with
   the old code no matter what the upgraded one runs. Remove stale installs where possible.
2. **Ops-2 — restart the extension-proxy pods after the final deploy.** Each extension
   redeploy leaves the previous `SESSION TIMEOUT LIVE <invokerId>` daemon orphaned (the
   monitor registry is classloader-scoped); orphans hold dead producers and drop whatever
   sweep they win. Only a JVM/pod restart clears them.
3. **Platform dependency.** The timeout pipeline itself (monitor → executeDefaultMessage →
   whether a message is sent at all) executes from the **appliance platform's** omni-sdk,
   not the daz (parent-first classloading; the SDK copy inside the fat jar is inert).
   Environments whose platform SDK predates the send-timeout-message flow will delete
   without sending regardless of this changeset — they need a platform upgrade.

## Log-signature cheat sheet (post-deploy verification)

| Log line (grep by accountId) | Meaning |
|---|---|
| `NO WEBSOCKET CONNECTION FOUND FOR ACCOUNT ID` | old build still running somewhere (this line is deleted by Fix 2) |
| `Adding connectionId: a_wsContact_…` + `does not belongs to this server` | Fix 2 present but Fix 3 missing (bare keys) |
| `ERROR WHILE SENDING MESSAGE FOR ACCOUNTID` with no recreate WARN | orphaned monitor / dead producer → pod restart needed |
| `ActiveMQ producer send failed; recreating connection and retrying send` | Fix 1 self-heal engaged (expected on transient broker faults) |
| `Adding connectionId: <real netty id>` + client receives message | **fixed end-to-end** ✅ |

## Out of scope for this document

`src/main/resources/integration/index.html` changes belong to the **concurrency
rate-limiting & idle-session feature (KR-21047)** — see
`docs/concurrency-rate-limiting-and-idle-session-spec.md`. That feature is master-flag
gated (`concurrencyControlEnabled`, default off) and independent of these delivery fixes.
