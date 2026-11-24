/*
 * Omni Chatbot Extension for Krista
 * Copyright (C) 2025 Krista Software
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

package app.krista.extensions.essentials.collaboration.omnichatbot;

import app.krista.extension.authorization.AuthorizationException;
import app.krista.extension.executor.Invoker;
import app.krista.extension.util.InvokerAttributes;
import app.krista.extension.util.ServiceRegistry;
import app.krista.extensions.essentials.collaboration.omnichatbot.auth.*;
import app.krista.ksdk.authorization.Role;
import app.krista.ksdk.context.ExecutionMode;
import app.krista.ksdk.context.RequestContext;
import app.krista.ksdk.workspace.Workspace;
import app.krista.omni.sdk.spi.impl.OmniChannelSession;
import app.krista.omni.sdk.spi.impl.services.SessionKeyGenerator;
import app.krista.extensions.essentials.collaboration.omnichatbot.contants.Constants;
import app.krista.extensions.essentials.collaboration.omnichatbot.resource.dto.SessionDto;
import app.krista.extensions.essentials.collaboration.omnichatbot.store.PoolStore;
import app.krista.extensions.essentials.collaboration.omnichatbot.store.SessionStore;
import app.krista.extensions.essentials.collaboration.omnichatbot.utils.ChatBotUtil;
import app.krista.ksdk.accounts.AccountManager;
import app.krista.ksdk.accounts.AccountProvider;
import app.krista.ksdk.accounts.ModifiableAccount;
import app.krista.ksdk.authorization.RoleManager;
import app.krista.extensions.util.KeyValueStore;
import app.krista.omni.sdk.medium.api.MediumService;
import app.krista.omni.sdk.medium.api.message.MediumInfo;
import app.krista.omni.sdk.medium.interactive.InteractiveMediumService;
import app.krista.omni.sdk.medium.interactive.InteractiveMessageIn;
import app.krista.omni.sdk.spi.SessionCreationResult;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.kristasoft.common.holders.ThreadLocalProxy;
import org.jvnet.hk2.annotations.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.inject.Inject;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Semaphore;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Warm pool of pre-created guest-authentication login responses.
 *
 * <p>Configuration time: when the chatbot's Authentication dependency is set, the pool fills
 * by invoking the bound auth extension's POST /login N times. Each captured ProtoResponse is
 * stored both durably (KeyValueStore) and in an in-memory queue for fast atomic pop.
 *
 * <p>Runtime: ChatBotExtension.forward() pops one entry per user login. On miss it falls
 * back to a live forward, so behavior is identical to today when the pool is empty.
 *
 * <p>Refill: every pop schedules a background refill on a virtual thread that
 * tops the pool back up to TARGET_POOL_SIZE — the consuming request returns
 * immediately and the next user finds a freshly-warmed entry waiting.
 */
@Service
public final class ChatBotPool {

    private static final Logger LOGGER = LoggerFactory.getLogger(ChatBotPool.class);

    private static final int TARGET_POOL_SIZE = 1000;
    // Sweep cycle interval. The pool sweep validates every pool entry against the
    // appliance — with the parallel sweep below a full TARGET_POOL_SIZE=1000 cycle
    // completes in ~2-3 s (vs ~50 s sequential), so we don't need to run every
    // 60 s anymore. 5 min keeps stale-entry detection well within any realistic
    // user-pop horizon while cutting background IAM load ~5×.
    private static final long SWEEP_INTERVAL_MS = 300_000L;
    private static final int SWEEP_CIRCUIT_BREAK_THRESHOLD = 5;
    // Max concurrent virtual threads creating pool entries during refill.
    // Throttle exists to avoid hammering IAM/JMS with hundreds of simultaneous
    // createAccount + createSession calls. Pool refill is still ~PARALLELISM
    // times faster than the previous sequential loop; raise only if IAM is
    // proven to handle the additional concurrent write load.
    private static final int PARALLEL_REFILL_CONCURRENCY = 20;
    private static final Gson GSON = new Gson();

    /**
     * How far into the future to push a freshly-warmed pool entry's
     * {@code lastMessageReceivedTime} so the OmniChannel SessionTimeoutMonitor
     * cannot destroy the session (and its underlying guest account) while it
     * is still waiting in the pool.
     *
     * <p>One year is comfortably larger than:
     * <ul>
     *   <li>any realistic configured SESSION_TIMEOUT (typically hours to days),</li>
     *   <li>any realistic pool-entry dwell time (typically minutes to hours,
     *       up to a few days for very low-traffic chatbots),</li>
     *   <li>the JWT refresh-token TTL (7 days).</li>
     * </ul>
     *
     * <p>When a user actually pops the entry,
     * {@code WsConnectionOpenedHandler.refreshSessionTimestamp} resets
     * {@code lastMessageReceivedTime} to the real current time so the monitor's
     * normal idle-timeout behavior resumes.
     */
    private static final long POOL_ENTRY_TIMESTAMP_BUFFER_MS =
            365L * 24L * 60L * 60L * 1000L;

    private final PoolStore poolStore;
    private final ChatBotAuthService authService;
    private final MediumService mediumService;
    private final SessionStore sessionStore;
    private final AccountProvider accountProvider;
    private final AccountManager accountManager;
    private final RoleManager roleManager;
    private final AuthAccountManager authAccountManager;
    private final Workspace workspace;
    private final Invoker invoker;
    private final KeyValueStore keyValueStore;
    private final ConcurrentLinkedDeque<String> availableKeys = new ConcurrentLinkedDeque<>();
    private final AtomicBoolean refilling = new AtomicBoolean(false);
    private final AtomicBoolean sweepRunning = new AtomicBoolean(false);
    private final AtomicInteger generation = new AtomicInteger(0);
    // Refill-cycle failure aggregation. Only one refill runs at a time (guarded by
    // `refilling`), so its parallel adoption/creation workers share these counters to
    // collapse a per-entry failure burst (up to TARGET_POOL_SIZE entries) into a single
    // detailed first log plus a trailing count — a systemic IAM/JMS outage must not emit
    // one warn per pool entry.
    private final AtomicInteger refillFailures = new AtomicInteger(0);
    private final AtomicBoolean refillFirstFailureLogged = new AtomicBoolean(false);
    // Count of pool-entry-creation tasks that have reserved a slot but
    // haven't yet either landed an entry into availableKeys or aborted.
    // Combined with availableKeys.size() this gives the upper bound on the
    // pool's eventual size — the slot reservation in tryReserveSlot ensures
    // (availableKeys.size() + inFlight) never exceeds TARGET_POOL_SIZE, so
    // even if addOneEntry is invoked more times than refillAsync intended
    // (e.g. via a future concurrency bug) the pool cannot overshoot.
    private final AtomicInteger inFlight = new AtomicInteger(0);
    private volatile Thread sweepThread;
    // Latest role we've been asked to converge to. Used by changeDefaultRoleAsync
    // to short-circuit duplicate same-role calls and to let queued tasks detect
    // they've been superseded by a newer save.
    private final AtomicReference<String> lastTargetRole = new AtomicReference<>();
    // Single-thread executor so role-change tasks serialize naturally — only one
    // task touches the pool's ModifiableAccounts and AuthAccountManager at any
    // time. A newer save bumps `generation`, the in-flight task aborts on its
    // next loop check, and the next queued task then runs.
    private final ExecutorService roleChangeExecutor = Executors.newSingleThreadExecutor(
            Thread.ofVirtual().name("chatbot-role-change-", 0).factory());
    // In-memory cache for the "Create Pool Users" Behavior toggle so refillAsync
    // doesn't have to parse the UI config JSON on every call (hot path: every
    // popInline, every saveUIConfig, every sweep cycle). Write-through:
    // ChatBotExtension.updateUiConfig and the first-load migration both push
    // here, mirroring how {@code ChatBotExtension.configCache} mirrors the KVS
    // copy of UI_CONFIG_JSON.
    private volatile boolean createPoolUsersEnabled = false;

    @Inject
    public ChatBotPool(PoolStore poolStore, ChatBotAuthService authService, SessionStore sessionStore,
            AccountProvider accountProvider, AccountManager accountManager,
            RoleManager roleManager, AuthAccountManager authAccountManager,
            Workspace workspace, Invoker invoker, KeyValueStore keyValueStore) {
        this.poolStore = poolStore;
        this.authService = authService;
        this.mediumService = InteractiveMediumService.getInstance();
        this.sessionStore = sessionStore;
        this.accountProvider = accountProvider;
        this.accountManager = accountManager;
        this.roleManager = roleManager;
        this.authAccountManager = authAccountManager;
        this.workspace = workspace;
        this.invoker = invoker;
        this.keyValueStore = keyValueStore;
        recoverFromStore();
        // Initial load: parse the toggle from whatever the KVS already has (if
        // a previous run persisted it). Updates after this come via
        // refreshCreatePoolUsersFlag() — no further KVS reads on hot paths.
        Object storedUiConfig = keyValueStore.get(Constants.UI_CONFIG_JSON);
        if (storedUiConfig != null) {
            refreshCreatePoolUsersFlag(storedUiConfig.toString());
        }
        startSweepLoop();
    }

    /**
     * Periodically validates every pool entry against the appliance so entries
     * for sessions whose accounts have been deleted, revoked, or otherwise
     * invalidated are dropped before they can be served. Runs on a virtual
     * thread; sweeps every SWEEP_INTERVAL_MS. A consecutive-failure circuit
     * breaker aborts a sweep cycle if many entries fail in a row (e.g. mass
     * user deletion), avoiding a storm of KSDK calls against the appliance.
     */
    private void startSweepLoop() {
        if (!sweepRunning.compareAndSet(false, true)) {
            return;
        }
        Map<Class<?>, Object> threadLocals = ThreadLocalProxy.getAll();
        sweepThread = Thread.startVirtualThread(() -> {
            ThreadLocalProxy.setAll(threadLocals);
            while (sweepRunning.get()) {
                try {
                    Thread.sleep(SWEEP_INTERVAL_MS);
                } catch (InterruptedException ie) {
                    // Two reasons we get interrupted here:
                    //   1. shutdown() flipped sweepRunning=false → exit cleanly.
                    //   2. wakeSweep() wants us to run the cycle NOW → fall
                    //      through to the body; the sweepRunning check at the
                    //      top of the while will keep us looping after.
                    if (!sweepRunning.get()) {
                        Thread.currentThread().interrupt();
                        return;
                    }
                }
                sweepInvalidEntries();
                changeDefaultRoleAsync();
                refillAsync();
                if (!createPoolUsersEnabled) {
                    deleteAllEntriesAsync();
                }
            }
        });
    }

    /**
     * Wakes the sweep loop early — used by saveUIConfig so toggle changes
     * are reflected on the pool immediately, without waiting up to 5 min for
     * the next sweep tick. The sweep loop runs in the pool's construction-time
     * thread-local context (which has working KSDK auth), so KSDK calls made
     * during the woken cycle succeed; the saveUIConfig request thread's
     * context cannot make those calls reliably.
     */
    public void wakeSweep() {
        Thread t = sweepThread;
        if (t != null) {
            t.interrupt();
        }
    }

    /**
     * Stops the background sweep loop. Invoked from ChatBotExtension.onInvokerUnload
     * so the virtual thread doesn't outlive the pool it was validating.
     */
    public void shutdown() {
        if (sweepRunning.compareAndSet(true, false)) {
            Thread t = sweepThread;
            if (t != null) {
                t.interrupt();
            }
        }
        roleChangeExecutor.shutdown();
    }

    private void sweepInvalidEntries() {
        if (availableKeys.isEmpty()) {
            return;
        }
        // Parallel sweep with the same throttle as refill — turns a ~50 s
        // sequential walk of 1000 entries into a ~2-3 s burst of 20 concurrent
        // accountProvider.getAccount() calls, freeing IAM for user traffic the
        // rest of the cycle. Total work is unchanged; distribution is bursty
        // instead of continuous.
        //
        // Circuit-breaker: a shared failureCount across all workers replaces
        // the sequential "consecutive failures" counter. Workers check the
        // counter before each IAM call and short-circuit when the threshold is
        // breached, so a storm of invalid entries (e.g. mass account deletion)
        // doesn't burn through TARGET_POOL_SIZE validation calls in one cycle.
        Map<Class<?>, Object> threadLocals = ThreadLocalProxy.getAll();
        java.util.List<String> snapshot = new ArrayList<>(availableKeys);
        AtomicInteger dropped = new AtomicInteger(0);
        AtomicInteger failureCount = new AtomicInteger(0);
        Semaphore throttle = new Semaphore(PARALLEL_REFILL_CONCURRENCY);
        CountDownLatch done = new CountDownLatch(snapshot.size());
        for (String key : snapshot) {
            Thread.startVirtualThread(() -> {
                try {
                    ThreadLocalProxy.setAll(threadLocals);
                    throttle.acquire();
                    if (failureCount.get() >= SWEEP_CIRCUIT_BREAK_THRESHOLD) {
                        return;
                    }
                    sweepOneEntry(key, dropped, failureCount);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                } finally {
                    throttle.release();
                    done.countDown();
                }
            });
        }
        try {
            done.await();
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
        int droppedTotal = dropped.get();
        if (droppedTotal > 0) {
            LOGGER.info("#####-CHATBOT POOL sweep dropped {} invalid entries", droppedTotal);
        }
        if (failureCount.get() >= SWEEP_CIRCUIT_BREAK_THRESHOLD) {
            LOGGER.warn("#####-CHATBOT POOL sweep circuit-break threshold ({}) reached during cycle; remaining workers skipped IAM calls",
                    SWEEP_CIRCUIT_BREAK_THRESHOLD);
        }
    }

    /**
     * Validates a single pool entry — runs on a per-key virtual thread inside
     * the parallel sweep cycle. Increments {@code droppedCount} on entries
     * that get pruned and {@code failureCount} on any failure (used by the
     * shared circuit-breaker to short-circuit the cycle).
     */
    private void sweepOneEntry(String key, AtomicInteger droppedCount, AtomicInteger failureCount) {
        String sessionIdForCleanup = null;
        try {
            String stored = poolStore.get(key);
            if (stored == null) {
                availableKeys.remove(key);
                return;
            }
            StoredEntry entry = GSON.fromJson(stored, StoredEntry.class);
            String sessionId = extractSessionId(entry.body);
            sessionIdForCleanup = sessionId;
            if (sessionId == null || entry.accountId == null) {
                availableKeys.remove(key);
                poolStore.delete(key);
                if (sessionId != null) {
                    safelyDeleteAuthCache(sessionId);
                }
                failureCount.incrementAndGet();
                droppedCount.incrementAndGet();
                return;
            }
            // Account validation alone is what we actually care about: is the
            // appliance-side account still alive? JWT/session expiry is
            // intentionally not checked here -- pool entries are looked up
            // via the authAccountManager cache on user requests
            // (see GuestRequestAuthenticator.resolveAccountIdFromSession),
            // which bypasses JWT validation entirely as long as the entry
            // exists in the cache. So an expired-but-cached entry continues
            // to authenticate the user successfully; there's no reason for
            // the sweep to drop it.
            accountProvider.getAccount(entry.accountId);
        } catch (AuthorizationException | NoSuchElementException ex) {
            availableKeys.remove(key);
            poolStore.delete(key);
            if (sessionIdForCleanup != null) {
                safelyDeleteAuthCache(sessionIdForCleanup);
            }
            failureCount.incrementAndGet();
            droppedCount.incrementAndGet();
        } catch (Exception cause) {
            LOGGER.warn("#####-CHATBOT POOL sweep error for key {}", key, cause);
            failureCount.incrementAndGet();
        }
    }

    private void safelyDeleteAuthCache(String sessionId) {
        try {
            authAccountManager.delete(sessionId);
        } catch (Exception cause) {
            LOGGER.warn("#####-CHATBOT POOL sweep failed to drop AuthAccountManager entry for session {}",
                    sessionId, cause);
        }
    }

    private static String extractSessionId(String loginBodyJson) {
        try {
            JsonObject body = JsonParser.parseString(loginBodyJson).getAsJsonObject();
            return body.has("clientSessionId") ? body.get("clientSessionId").getAsString() : null;
        } catch (Exception cause) {
            return null;
        }
    }

    private void recoverFromStore() {
        try {
            poolStore.getKeys().forEach(availableKeys::offer);
        } catch (Exception cause) {
            LOGGER.warn("#####-CHATBOT POOL recovery failed", cause);
        }
    }

    public int size() {
        return availableKeys.size();
    }

    /**
     * Publishes the entry's accountId → inboxId mapping into the chatbot's local
     * SessionStore (mirroring what the live /session endpoint does on first call).
     * Returns {@code true} on success, {@code false} on failure or invalid entry —
     * the caller uses this to decide whether the entry is safe to consume.
     */
    private boolean publishToSessionStore(StoredEntry entry) {
        if (entry == null || entry.accountId == null || entry.inboxId == null) {
            return false;
        }
        try {
            sessionStore.put(entry.accountId, new SessionDto(entry.inboxId));
            return true;
        } catch (Exception cause) {
            LOGGER.warn("#####-CHATBOT POOL sessionStore.put failed for account {}", entry.accountId, cause);
            return false;
        }
    }

    /**
     * Atomically pops one entry for inline injection into index.html. Publishes the
     * accountId → inboxId mapping into SessionStore (mirroring what the live /session
     * endpoint would do on first call), and returns the raw login response body JSON
     * + inbox id so the caller can inject them into the served HTML.
     *
     * <p>Publishes to SessionStore BEFORE deleting from PoolStore: the Welcome
     * Conversation auto-trigger in {@code WsConnectionOpenedHandler} looks up
     * the SessionDto by accountId, so the pool entry must only be consumed
     * after that mapping is durably published. If the publish fails we restore
     * the key to {@code availableKeys} and return empty so the caller falls
     * through to live login (which publishes via {@code ChatBotApiService})
     * rather than handing out an auth response the welcome path can't honour.
     */
    public Optional<PooledAuth> popInline() {
        String key = availableKeys.pollFirst();
        try {
            if (key == null) {
                return Optional.empty();
            }
            String stored = poolStore.get(key);
            if (stored == null) {
                LOGGER.warn("#####-CHATBOT POOL entry missing in PoolStore for key {}", key);
                return Optional.empty();
            }
            StoredEntry entry = GSON.fromJson(stored, StoredEntry.class);
            if (!publishToSessionStore(entry)) {
                // Publish failed — don't consume the entry. Put the key back at
                // the head of the deque so the next pop tries it again (or the
                // next chatbot restart recovers it via poolStore).
                availableKeys.offerFirst(key);
                return Optional.empty();
            }
            poolStore.delete(key);
            LOGGER.info("#####-CHATBOT POOL user fetched from pool, accountId={}, remainingPoolSize={}",
                    entry.accountId, availableKeys.size());
            return Optional.of(new PooledAuth(entry.body, entry.accountId, entry.inboxId));
        } catch (Exception cause) {
            LOGGER.warn("#####-CHATBOT POOL popInline failed for key {}", key, cause);
            return Optional.empty();
        } finally {
            refillAsync();
        }
    }

    /**
     * Re-parses the UI config JSON and caches the {@code createPoolUsers}
     * flag for fast read on the hot path. Callers
     * ({@code ChatBotExtension.updateUiConfig} on every save,
     * {@code ChatBotExtension.migrateUiConfigToKeyValueStore} on first-load
     * migration) must invoke this whenever the JSON in KVS changes so the
     * cached flag stays consistent. Defensive: malformed JSON disables the
     * toggle.
     */
    public void refreshCreatePoolUsersFlag(String uiConfigJson) {
        try {
            Map<String, Object> configMap = ChatBotUtil.getConfigMap(uiConfigJson);
            this.createPoolUsersEnabled = Boolean.TRUE.equals(configMap.get("createPoolUsers"));
        } catch (Exception cause) {
            this.createPoolUsersEnabled = false;
        }
    }

    /**
     * Returns whether the "Create Pool Users" Behavior toggle is enabled.
     * Lets ChatBotAuthResource short-circuit GET /authn/pool-entry to a 204
     * when the feature is off, without touching the pool — defense-in-depth
     * against stale FE bundles, direct API hits, and any caller that didn't
     * already consult the flag.
     */
    public boolean isCreatePoolUsersEnabled() {
        return createPoolUsersEnabled;
    }

    public record PooledAuth(String loginBodyJson, String accountId, String inboxId) {
    }

    /**
     * Refill the pool to TARGET_POOL_SIZE on a virtual thread. Resolves the
     * target {@code default_role} ONCE per refill cycle and threads the final
     * name through to {@code addOneEntry} / orphan-adoption / role
     * reconciliation — no resolver fallback lives further down the stack.
     *
     * <p>Reads the current Default Role from {@code invoker.getAttributes()},
     * falling back to {@link AuthConstants#DEFAULT_ROLE_FOR_NEW_ACCOUNT}
     * ("Krista Guest User") when unset. The role is created on the appliance
     * on demand if it doesn't yet exist, matching {@link AccountProvisioner}'s
     * behaviour during fresh account creation.
     *
     * <p>Gated on the "Create Pool Users" Behavior setting: when off, this
     * method returns immediately without claiming the refill lock. Callers
     * (popInline tail, saveUIConfig, the sweep loop) can therefore invoke
     * unconditionally — the gate lives here.
     *
     * <p>Idempotent: at most one refill runs at a time. Captures the caller's
     * {@code ThreadLocalProxy} state and replays it inside the worker so that
     * RequestContext / AuthorizationContext / RuntimeContext proxies resolve
     * to the same per-invoker instances they would on the calling thread.
     */
    public void refillAsync() {
        if (!createPoolUsersEnabled) {
            return;
        }
        if (!refilling.compareAndSet(false, true)) {
            return;
        }
        final int myGeneration = generation.get();
        Map<Class<?>, Object> threadLocals = ThreadLocalProxy.getAll();
        Thread.startVirtualThread(() -> {
            try {
                refillFailures.set(0);
                refillFirstFailureLogged.set(false);
                // Cheap size check first — no thread-local context needed for a
                // ConcurrentLinkedDeque size read. Only set up the proxies if we
                // actually have work to do (addOneEntry needs RequestContext /
                // AuthorizationContext / RuntimeContext to resolve correctly).
                int currentSize = availableKeys.size();
                int needed = TARGET_POOL_SIZE - currentSize;
                if (needed <= 0) {
                    return;
                }
                LOGGER.info("#####-CHATBOT POOL refill triggered: currentSize={}, targetSize={}, creating {} new entries",
                        currentSize, TARGET_POOL_SIZE, needed);
                ThreadLocalProxy.setAll(threadLocals);

                final String effectiveRole = InvokerAttributes.getStringOrDefault(this.invoker.getAttributes(),
                        AuthConstants.DEFAULT_ROLE_KEY, AuthConstants.DEFAULT_ROLE_FOR_NEW_ACCOUNT);

                // First try to adopt orphan accounts left behind by previously-
                // removed chatbot invokers. Cheaper than creating new accounts
                // (no createAccount round-trip) and keeps workspace footprint
                // bounded across the chatbot's remove/re-add lifecycle.
                int adopted = adoptOrphansUpTo(needed, myGeneration, effectiveRole);
                needed -= adopted;
                if (adopted > 0) {
                    LOGGER.info("#####-CHATBOT POOL adopted {} orphan accounts, still need {} new entries",
                            adopted, needed);
                }
                if (needed <= 0) {
                    return;
                }

                // Parallel live-creation phase. Submit exactly `needed` worker tasks
                // (computed upfront, never re-derived inside workers) and gate them
                // through a Semaphore so at most PARALLEL_REFILL_CONCURRENCY hit
                // IAM/JMS concurrently. Each worker also re-checks the generation
                // counter so a mid-refill role change cleanly aborts pending workers.
                //
                // Safety: pool size cannot overshoot TARGET_POOL_SIZE because
                // addOneEntry's tryReserveSlot guard atomically refuses to create
                // once size + in-flight reaches the cap — even if the upfront task
                // count is somehow exceeded by a future bug or replay.
                final int finalNeeded = needed;
                Semaphore throttle = new Semaphore(PARALLEL_REFILL_CONCURRENCY);
                CountDownLatch done = new CountDownLatch(finalNeeded);
                for (int i = 0; i < finalNeeded; i++) {
                    Thread.startVirtualThread(() -> {
                        try {
                            ThreadLocalProxy.setAll(threadLocals);
                            throttle.acquire();
                            if (generation.get() != myGeneration) {
                                return;
                            }
                            addOneEntry(effectiveRole);
                        } catch (InterruptedException ie) {
                            Thread.currentThread().interrupt();
                        } finally {
                            throttle.release();
                            done.countDown();
                        }
                    });
                }
                try {
                    done.await();
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                }
            } finally {
                int failed = refillFailures.get();
                if (failed > 0) {
                    LOGGER.warn("#####-CHATBOT POOL refill cycle: {} entry-prep failures (first logged above)", failed);
                }
                refilling.set(false);
            }
        });
    }

    /**
     * Records one refill-cycle failure: logs the FIRST failure of the cycle in full
     * (with cause when available) and only counts the rest, so a whole-pool outage
     * collapses to a single detailed log plus the count summary emitted at cycle end.
     * Thread-safe for the parallel adoption/creation workers. See {@link #refillFailures}.
     */
    private void recordRefillFailure(String context, Throwable cause) {
        refillFailures.incrementAndGet();
        if (refillFirstFailureLogged.compareAndSet(false, true)) {
            LOGGER.warn("#####-CHATBOT POOL refill first failure ({})", context, cause);
        }
    }

    private void recordRefillFailure(String context) {
        refillFailures.incrementAndGet();
        if (refillFirstFailureLogged.compareAndSet(false, true)) {
            LOGGER.warn("#####-CHATBOT POOL refill first failure ({})", context);
        }
    }

    /**
     * Scans every account in the workspace looking for orphans —
     * KRISTA_SOURCE=Omni Chatbot accounts whose OWNER_INVOKER_ID points at an
     * invoker that no longer exists in the workspace. Adopts up to {@code limit}
     * such orphans into this pool. Returns the number adopted.
     *
     * <p>Multi-chatbot safety: skips accounts whose OWNER_INVOKER_ID is still
     * in {@code workspace.getInvokerIds()} — those belong to another live
     * chatbot, not an orphan.
     */
    private int adoptOrphansUpTo(int limit, int myGeneration, String roleNameOverride) {
        if (limit <= 0) {
            return 0;
        }
        int adopted = 0;
        try {
            java.util.Set<String> activeInvokerIds = new java.util.HashSet<>();
            for (String id : workspace.getInvokerIds()) {
                activeInvokerIds.add(id);
            }
            String currentInvokerId = invoker.getInvokerId();
            for (String accountId : accountManager.getAccountIds()) {
                if (adopted >= limit || generation.get() != myGeneration) {
                    break;
                }
                try {
                    // Single lookup — fetched once, reused for attribute checks,
                    // the adoption auth call, and the KRISTA_SOURCE rewrite.
                    ModifiableAccount acc = accountManager.getAccount(accountId);
                    if (acc == null) {
                        continue;
                    }
                    String source = readStringAttribute(acc,
                            app.krista.extensions.essentials.collaboration.omnichatbot.auth.AuthConstants
                                    .KRISTA_SOURCE_KEY);
                    if (source == null || !source.startsWith(
                            app.krista.extensions.essentials.collaboration.omnichatbot.auth.AuthConstants
                                    .KRISTA_SOURCE_OMNI_CHATBOT)) {
                        continue;   // not a chatbot account
                    }
                    String ownerId = extractOwnerInvokerIdFromKristaSource(source);
                    if (ownerId == null || ownerId.isBlank()) {
                        continue;   // legacy account without owner suffix — leave alone
                    }
                    if (currentInvokerId.equals(ownerId)) {
                        continue;   // already ours from a prior load — pool recovery handles these
                    }
                    if (activeInvokerIds.contains(ownerId)) {
                        continue;   // owned by another live chatbot — don't steal
                    }
                    if (addAdoptedEntry(acc, roleNameOverride)) {
                        adopted++;
                    }
                } catch (Exception perAccountCause) {
                    recordRefillFailure("adoption: failed to inspect account " + accountId, perAccountCause);
                }
            }
            if (adopted > 0) {
                LOGGER.info("#####-CHATBOT POOL adoption: adopted {} orphan accounts", adopted);
            }
        } catch (Exception cause) {
            LOGGER.warn("#####-CHATBOT POOL adoption scan failed", cause);
        }
        return adopted;
    }

    /**
     * Drains every pool entry (in-memory deque + persistent KVS rows) without
     * refilling. Invoked from {@code ChatBotExtension.onInvokerRemoved} so the
     * underlying KeyValueStore doesn't keep orphan {@code chatbot-pool-login-*}
     * entries pointing at appliance accounts that have just been deleted by
     * {@code mediumService.deleteAccounts()}.
     *
     * <p>Bumps the generation counter so any straggler refill virtual thread
     * (extremely unlikely after sweep shutdown, but defensive) aborts on its
     * next loop iteration instead of repopulating the store mid-drain.
     */
    public void deleteAllEntries() {
        generation.incrementAndGet();
        availableKeys.clear();
        try {
            poolStore.deleteAll();
        } catch (Exception cause) {
            LOGGER.warn("#####-CHATBOT POOL deleteAllEntries failed", cause);
        }
    }

    /**
     * Async drain: clears the pool's in-memory deque + KVS rows AND deletes
     * only the appliance accounts that belonged to the pool. Runs on a virtual
     * thread so the calling request isn't blocked.
     *
     * <p>Used by the sweep loop when the "Create Pool Users" toggle is off.
     * Only pool accounts are removed — active chat sessions that were already
     * popped from the pool are left untouched.
     *
     * <p>Skips entirely when the in-memory deque is already empty, so
     * repeated off-saves don't keep spawning threads to do no-op work.
     */
    public void deleteAllEntriesAsync() {
        if (availableKeys.isEmpty()) {
            return;
        }
        List<String[]> poolEntries = collectPoolEntryPairs();
        Map<Class<?>, Object> threadLocals = ThreadLocalProxy.getAll();
        Thread.startVirtualThread(() -> {
            ThreadLocalProxy.setAll(threadLocals);
            deleteAllEntries();
            int deleted = 0;
            boolean firstFailureLogged = false;
            for (String[] pair : poolEntries) {
                try {
                    // pair[0] = sessionId, pair[1] = accountId
                    if (pair[1] != null) {
                        accountManager.deleteAccount(pair[1]);
                    }
                    if (pair[0] != null) {
                        safelyDeleteAuthCache(pair[0]);
                    }
                    deleted++;
                } catch (Exception cause) {
                    if (!firstFailureLogged) {
                        LOGGER.warn("#####-CHATBOT POOL deleteAllEntriesAsync: first failure deleting account {} (further failures reflected in the deleted/total summary)", pair[1], cause);
                        firstFailureLogged = true;
                    }
                }
            }
            LOGGER.info("#####-CHATBOT POOL deleteAllEntriesAsync: deleted {}/{} pool accounts",
                    deleted, poolEntries.size());
        });
    }

    /**
     * Collects sessionId + accountId pairs from the current pool entries.
     * Called before clearing the deque so we know exactly which accounts
     * belong to the pool — active chat users are not affected.
     */
    private List<String[]> collectPoolEntryPairs() {
        List<String[]> pairs = new ArrayList<>();
        boolean firstFailureLogged = false;
        int failures = 0;
        for (String key : new ArrayList<>(availableKeys)) {
            try {
                String stored = poolStore.get(key);
                if (stored != null) {
                    StoredEntry entry = GSON.fromJson(stored, StoredEntry.class);
                    String sessionId = extractSessionId(entry.body);
                    if (entry.accountId != null) {
                        pairs.add(new String[]{sessionId, entry.accountId});
                    }
                }
            } catch (Exception cause) {
                failures++;
                if (!firstFailureLogged) {
                    LOGGER.warn("#####-CHATBOT POOL collectPoolEntryPairs: first failure reading entry for key {} (further failures counted in summary)", key, cause);
                    firstFailureLogged = true;
                }
            }
        }
        if (failures > 0) {
            LOGGER.warn("#####-CHATBOT POOL collectPoolEntryPairs: {} entries unreadable this pass (first logged above)", failures);
        }
        return pairs;
    }

    /**
     * Updates the default role on every pooled account in place, instead of
     * dropping all entries (orphaning their appliance accounts) and rebuilding
     * the pool from scratch. Invoked from
     * ChatBotExtension.onInvokerAttributesUpdated when the Default Role
     * attribute changes.
     *
     * <p>The "drop and rebuild" strategy is wasteful in two ways: it leaves
     * 100 abandoned guest accounts in the appliance per role change (which
     * accumulate and degrade appliance performance over time), and it makes
     * the pool cold during the rebuild so new users pay live-login latency.
     * Updating in place keeps the pool warm and creates zero orphans.
     *
     * <p>For each entry: look up the account via the workspace-admin
     * {@link AccountManager}, add the new role and then remove every other
     * role on the account (add-before-remove so the account is never left
     * with zero roles mid-update), and update the cached
     * {@link AuthenticationResponse} so the role list a popped entry carries
     * matches what the appliance now knows. Entries we
     * cannot update (e.g. account was already deleted) are dropped — the pool
     * shrinks until the next {@code popInline} triggers a fresh refill (gated
     * on the "Create Pool Users" setting), which provisions replacements using
     * the newly-saved role.
     *
     * <p>{@code ModifiableAccount} explicitly documents that
     * "existing sessions will work without any issue" when an account is
     * modified, so the cached JWT in each pool entry remains valid after the
     * role swap.
     */
    public void changeDefaultRoleAsync() {
        final String effectiveNewRole = InvokerAttributes.getStringOrDefault(invoker.getAttributes(),
                AuthConstants.DEFAULT_ROLE_KEY, AuthConstants.DEFAULT_ROLE_FOR_NEW_ACCOUNT);

        // Skip duplicate same-role calls: if the previously-recorded target
        // equals this one, an in-flight or queued task is already converging
        // there, so there is nothing new to do.
        String previousTarget = lastTargetRole.getAndSet(effectiveNewRole);
        if (effectiveNewRole.equals(previousTarget)) {
            return;
        }

        // Bump generation so any task currently iterating the pool aborts on
        // its next per-entry check and yields control to this newer task.
        generation.incrementAndGet();
        Map<Class<?>, Object> threadLocals = ThreadLocalProxy.getAll();
        roleChangeExecutor.submit(() -> {
            ThreadLocalProxy.setAll(threadLocals);
            // A still-newer save may have superseded us while we waited in the
            // queue — skip immediately if we're no longer the latest target.
            if (!effectiveNewRole.equals(lastTargetRole.get())) {
                return;
            }
            final int myGen = generation.get();
            while (refilling.get()) {
                Thread.yield();
            }
            int updated = 0;
            int dropped = 0;
            boolean firstFailureLogged = false;
            String newRoleId = RoleUtils.resolveRoleId(roleManager, effectiveNewRole, true);
            if (newRoleId == null) {
                // Abort: proceeding with a null role id would NPE inside refreshCachedRoles
                // (List.of(null)), get caught per entry as a "role change failed", and
                // silently drop every pool entry — draining the pool for a typo'd role.
                LOGGER.warn("#####-CHATBOT POOL role change aborted: could not resolve role '{}'", effectiveNewRole);
                return;
            }
            for (String key : new ArrayList<>(availableKeys)) {
                if (generation.get() != myGen) {
                    LOGGER.info("#####-CHATBOT POOL role change aborted (newer change started); updated={} dropped={}",
                            updated, dropped);
                    return;
                }
                try {
                    String stored = poolStore.get(key);
                    if (stored == null) {
                        availableKeys.remove(key);
                        continue;
                    }
                    StoredEntry entry = GSON.fromJson(stored, StoredEntry.class);
                    if (entry.accountId == null) {
                        availableKeys.remove(key);
                        poolStore.delete(key);
                        dropped++;
                        continue;
                    }
                    ModifiableAccount account = accountManager.getAccount(entry.accountId);
                    account.addRole(newRoleId);
                    String[] stale = account.getRoles().stream()
                            .map(Role::getRoleId)
                            .filter(id -> !id.equals(newRoleId))
                            .toArray(String[]::new);
                    if (stale.length > 0) {
                        account.removeRole(stale);
                    }
                    refreshCachedRoles(entry, newRoleId, key);
                    updated++;
                } catch (Exception cause) {
                    if (!firstFailureLogged) {
                        LOGGER.warn("#####-CHATBOT POOL role change first failure for key {}; dropping entry (further failures counted in summary)", key, cause);
                        firstFailureLogged = true;
                    }
                    availableKeys.remove(key);
                    try {
                        poolStore.delete(key);
                    } catch (Exception ignored) {
                    }
                    dropped++;
                }
            }
            LOGGER.info("#####-CHATBOT POOL role change: updated {} entries in place, dropped {}",
                    updated, dropped);
        });
    }

    /**
     * Updates the role list inside the {@link AuthAccountManager} cache so a
     * popped entry's cached AuthenticationResponse reflects the new role.
     * Without this, the appliance has the new role but our local cache still
     * advertises the old one for the lifetime of the user's session.
     *
     * <p>Operates on role IDs because AuthenticationResponse.roles stores IDs
     * (see ChatBotAuthService.getListOfRoles).
     */
    private void refreshCachedRoles(StoredEntry entry, String newRoleId, String poolKey) {
        String sessionId = extractSessionId(entry.body);
        if (sessionId == null) {
            return;
        }
        AuthenticationResponse cached = authAccountManager.get(sessionId);
        if (cached == null) {
            return;
        }
        java.util.List<String> roles = new ArrayList<>(List.of(newRoleId));
        AuthenticationResponse updatedResponse = new AuthenticationResponse(
                cached.getClientSessionId(),
                cached.getName(),
                cached.getAvatarUrl(),
                cached.getAccountId(),
                cached.getKristaAccountId(),
                cached.getPersonId(),
                roles,
                cached.getInboxId(),
                cached.isWorkspaceAdmin(),
                cached.isApplianceManager(),
                cached.getIdentificationToken(),
                cached.getExtras());
        authAccountManager.put(sessionId, updatedResponse);
        updatePoolStoreEntry(entry, updatedResponse, poolKey);
    }

    /**
     * Persists the updated login body back to the pool store so that
     * a JVM restart or subsequent popInline serves the current role.
     */
    private void updatePoolStoreEntry(StoredEntry original, AuthenticationResponse updatedResponse, String poolKey) {
        try {
            StoredEntry updated = new StoredEntry();
            updated.body = GSON.toJson(updatedResponse);
            updated.accountId = original.accountId;
            updated.inboxId = original.inboxId;
            poolStore.put(poolKey, GSON.toJson(updated));
        } catch (Exception cause) {
            LOGGER.warn("#####-CHATBOT POOL updatePoolStoreEntry: failed to update poolStore for key {}", poolKey, cause);
        }
    }

    // Returns true if the entry was successfully created and queued, false otherwise.
    // A false return aborts the current refill cycle so we don't burn TARGET_POOL_SIZE
    // calls in a row when the underlying problem is persistent. The most common
    // persistent cause is the per-invoker "Trust Extension" toggle being off, which
    // makes admin-gated KSDK calls (e.g. getSupportedDomains) return HTTP 500. The
    // framework doesn't expose that flag to extensions today (ReflectInvoker holds
    // hasWorkspaceAdminRights privately), so we can't distinguish it from a transient
    // appliance error — fail-fast covers both correctly: next lifecycle event will
    // retry, but we won't hammer the appliance with N sequential failures per cycle.
    /**
     * Adopts an existing workspace account (orphaned from a previously-removed
     * chatbot invoker) into this pool. Mints a fresh JWT session + cached
     * AuthenticationResponse for the existing accountId, pre-warms the
     * OmniChannel session, updates the OWNER_INVOKER_ID attribute to point at
     * this invoker, and persists a poolStore entry indistinguishable from one
     * created by {@link #addOneEntry()}. Returns true on success.
     *
     * <p>If pool refill is already saturated when adoption runs, the entry is
     * still added and the pool simply ends up with one more entry than
     * TARGET_POOL_SIZE for a short period — the sweep / pop balance will
     * absorb the excess.
     */
    /**
     * Reads a String attribute value off an account by name. Works around the
     * default {@code Account.getAttributeValue(name)} implementation in the
     * framework which returns a {@code Map.Entry} (not the value) — making
     * {@code instanceof String} checks against its result always fail. We
     * iterate {@link app.krista.ksdk.accounts.Account#getAttributes()} directly
     * and pull out the value when the {@code Attribute.getName()} matches.
     */
    private static String readStringAttribute(app.krista.ksdk.accounts.Account account, String attributeName) {
        if (account == null) {
            return null;
        }
        Map<app.krista.ksdk.accounts.Attribute, Object> attrs = account.getAttributes();
        if (attrs == null) {
            return null;
        }
        for (Map.Entry<app.krista.ksdk.accounts.Attribute, Object> e : attrs.entrySet()) {
            if (e.getKey() != null && Objects.equals(attributeName, e.getKey().getName())) {
                Object v = e.getValue();
                if (v instanceof String s) {
                    return s;
                }
                return v == null ? null : v.toString();
            }
        }
        return null;
    }

    /**
     * Parses the owner-invoker id out of a KRISTA_SOURCE value of the form
     * {@code "Omni Chatbot|<invokerId>"}. Returns {@code null} when the value
     * is the legacy plain {@code "Omni Chatbot"} (no suffix).
     */
    private static String extractOwnerInvokerIdFromKristaSource(String source) {
        if (source == null) {
            return null;
        }
        int sep = source.indexOf('|');
        if (sep < 0 || sep == source.length() - 1) {
            return null;
        }
        return source.substring(sep + 1);
    }

    /**
     * Ensures an adopted account carries this chatbot's currently-configured
     * {@code default_role}, not whatever role its previous owner-chatbot had.
     * Caller passes the already-resolved target role name (the refill cycle
     * resolves once and threads the final value through). Resolves it to a
     * role id, adds it to the account if missing, and removes any other roles
     * the account had (clean slate so the cached AuthenticationResponse later
     * reflects exactly one role — the right one).
     */
    private void reconcileAdoptedAccountRole(ModifiableAccount account, String targetRoleName) {
        String targetRoleId = RoleUtils.resolveRoleId(roleManager, targetRoleName, true);
        if (targetRoleId == null) {
            recordRefillFailure("adoption: could not resolve target role '" + targetRoleName
                    + "' for " + account.getAccountId() + "; skipping reconcile");
            return;
        }
        java.util.Set<String> currentRoleIds = new java.util.HashSet<>();
        for (app.krista.ksdk.authorization.Role r : account.getRoles()) {
            currentRoleIds.add(r.getRoleId());
        }
        if (!currentRoleIds.contains(targetRoleId)) {
            account.addRole(targetRoleId);
        }
        for (String otherRoleId : currentRoleIds) {
            if (!otherRoleId.equals(targetRoleId)) {
                account.removeRole(otherRoleId);
            }
        }
    }

    public boolean addAdoptedEntry(ModifiableAccount account, String roleNameOverride) {
        String accountId = account.getAccountId();
        try {
            // Reconcile role BEFORE minting the AuthenticationResponse so the
            // cached response embedded in the pool entry reflects the current
            // chatbot's default_role, not whatever role the previous chatbot
            // configured. Orphans inherit the old chatbot's role; this fixes
            // that.
            try {
                reconcileAdoptedAccountRole(account, roleNameOverride);
            } catch (Exception roleCause) {
                recordRefillFailure("adoption: role reconciliation failed for " + accountId
                        + "; proceeding with existing roles", roleCause);
            }
            AuthenticationResponse authResponse = authService.adoptExistingAccount(account);
            if (authResponse.getAccountId() == null) {
                recordRefillFailure("adoption returned response without accountId; skipping");
                return false;
            }
            String inboxId = preWarmSession(accountId);
            if (inboxId == null) {
                // Pre-warm failure already recorded inside preWarmSession.
                return false;
            }
            // Re-tag the adopted account so future adoption scans don't keep
            // re-picking it (and so the multi-chatbot safety check has the
            // current invoker as the owner). We rewrite KRISTA_SOURCE rather
            // than writing a separate OWNER_INVOKER_ID attribute to avoid the
            // workspace user-attribute duplication race (see
            // AuthConstants.KRISTA_SOURCE_OMNI_CHATBOT_PREFIX comment).
            try {
                account.updateAttributeValue(
                        app.krista.extensions.essentials.collaboration.omnichatbot.auth.AuthConstants.KRISTA_SOURCE_KEY,
                        app.krista.extensions.essentials.collaboration.omnichatbot.auth.AuthConstants
                                .KRISTA_SOURCE_OMNI_CHATBOT_PREFIX + invoker.getInvokerId());
            } catch (Exception updateCause) {
                recordRefillFailure("adoption: failed to update KRISTA_SOURCE owner suffix on " + accountId,
                        updateCause);
            }
            StoredEntry entry = new StoredEntry();
            entry.body = GSON.toJson(authResponse);
            entry.accountId = accountId;
            entry.inboxId = inboxId;
            String key = PoolStore.newKey();
            poolStore.put(key, GSON.toJson(entry));
            availableKeys.offer(key);
            return true;
        } catch (Exception cause) {
            recordRefillFailure("adoption failed for account " + accountId, cause);
            return false;
        }
    }

    /**
     * Atomically reserves an entry slot in the pool if doing so would keep the
     * pool at or below TARGET_POOL_SIZE. Combines availableKeys.size() with the
     * count of in-flight reservations so concurrent workers cannot collectively
     * exceed the threshold even when they all see the same stale size reading.
     * Returns {@code true} when a slot was successfully reserved (caller must
     * pair with {@link #releaseSlot()}), {@code false} when the pool is already
     * at/over target — in which case the caller must NOT proceed with creation.
     *
     * <p>This is the load-bearing guard that makes addOneEntry safe to invoke
     * more than once concurrently: even if a future refactor or bug invokes it
     * twice for the same logical slot, the second call sees inFlight already
     * incremented and refuses with {@code false}.
     */
    private boolean tryReserveSlot() {
        while (true) {
            int currentInFlight = inFlight.get();
            int currentSize = availableKeys.size();
            if (currentSize + currentInFlight >= TARGET_POOL_SIZE) {
                return false;
            }
            if (inFlight.compareAndSet(currentInFlight, currentInFlight + 1)) {
                return true;
            }
            // CAS lost race — re-read both counters and try again.
        }
    }

    private void releaseSlot() {
        inFlight.decrementAndGet();
    }

    private boolean addOneEntry(String roleNameOverride) {
        // Defensive cap: refuse to create another entry once the pool is at or
        // over TARGET_POOL_SIZE (counting in-flight creations). Even if the
        // refillAsync task count is somehow exceeded, this gate prevents the
        // pool from over-creating guest accounts in IAM.
        if (!tryReserveSlot()) {
            return false;
        }
        try {
            AuthenticationResponse authResponse = authService.provisionGuestSession(true, roleNameOverride);
            if (authResponse.getAccountId() == null) {
                recordRefillFailure("provisionGuestSession returned an entry without an accountId; skipping");
                return false;
            }
            String accountId = authResponse.getAccountId();
            String inboxId = preWarmSession(accountId);
            if (inboxId == null) {
                // Pre-warm failure already recorded inside preWarmSession.
                return false;
            }
            StoredEntry entry = new StoredEntry();
            entry.body = GSON.toJson(authResponse);
            entry.accountId = accountId;
            entry.inboxId = inboxId;
            String key = PoolStore.newKey();
            poolStore.put(key, GSON.toJson(entry));
            availableKeys.offer(key);
            return true;
        } catch (Exception cause) {
            recordRefillFailure("entry creation failed", cause);
            return false;
        } finally {
            // Slot reserved at the top of this method is released regardless of
            // success or failure. On success the entry is now in availableKeys
            // so size + (inFlight-1) is unchanged; on failure the slot simply
            // becomes available for a retry on the next refill cycle.
            releaseSlot();
        }
    }

    private String preWarmSession(String accountId) {
        try {
            InteractiveMessageIn messageIn = new InteractiveMessageIn(
                    new MediumInfo(Constants.MEDIUM_TYPE, accountId), null);
            // Combined getOrCreateSession API returns Account + sessionInboxId
            // in one JMS round-trip, replacing the previous getAuthenticatedAccount
            // + getSessionInbox pair. Per-entry saving multiplies by TARGET_POOL_SIZE
            // on full pool fill — sizeable on chatbot startup.
            SessionCreationResult result = mediumService.getOrCreateSession(messageIn, "en");
            if (result == null || result.account() == null || result.sessionInboxId() == null) {
                recordRefillFailure("getOrCreateSession returned incomplete result for account " + accountId);
                return null;
            }
            // Push the OmniChannelSession's lastMessageReceivedTime far into the
            // future so the SessionTimeoutMonitor (15-min cycle) does NOT
            // destroy this entry while it's sitting in the pool waiting to be
            // popped. WsConnectionOpenedHandler.refreshSessionTimestamp will
            // reset this back to a real "now" value the moment a user actually
            // pops the entry and opens their WS.
            extendPoolEntrySessionTimeout(accountId);
            return result.sessionInboxId();
        } catch (Exception cause) {
            recordRefillFailure("session pre-warm failed for account " + accountId, cause);
            return null;
        }
    }

    /**
     * Pushes the OmniChannelSession's {@code lastMessageReceivedTime} far into
     * the future (see {@link #POOL_ENTRY_TIMESTAMP_BUFFER_MS}) for a freshly-warmed
     * pool entry. The SessionTimeoutMonitor checks
     * {@code System.currentTimeMillis() - lastMessageReceivedTime > SESSION_TIMEOUT}
     * to decide whether to destroy the session (and, for chatbot @omni.com
     * accounts, schedule account deletion). With a future timestamp the
     * subtraction is negative, never exceeding any reasonable SESSION_TIMEOUT,
     * so the monitor leaves the entry alone.
     *
     * <p>Once a user actually pops the entry and opens the WebSocket, the
     * {@code refreshSessionTimestamp} hook in {@code WsConnectionOpenedHandler}
     * calls {@code mediumService.getAuthenticatedAccount(...)} which resets
     * this field to the real {@code System.currentTimeMillis()} — restoring
     * normal SESSION_TIMEOUT semantics for the user's active session.
     *
     * <p>Best-effort: any failure here (e.g., framework refactor of the
     * internal classes we touch) falls back to default behaviour — the entry
     * stays in the pool with a real-now timestamp and is subject to
     * SessionTimeoutMonitor like any other session. No regression vs today.
     */
    private void extendPoolEntrySessionTimeout(String accountId) {
        try {
            RequestContext requestContext = ThreadLocalProxy.getThreadLocal(RequestContext.class).get();
            if (requestContext == null) {
                LOGGER.warn("#####-CHATBOT POOL extend-timeout: no RequestContext on thread for accountId={}",
                        accountId);
                return;
            }
            ExecutionMode executionMode = requestContext.getExecutionMode();
            String sessionKey = new SessionKeyGenerator().generate(
                    accountId, requestContext.getInvokerId(), executionMode);
            // Use FQN here because the simple name SessionStore is already
            // imported and bound to the chatbot's own SessionStore class.
            app.krista.omni.sdk.spi.impl.store.SessionStore omniSessionStore =
                    app.krista.omni.sdk.spi.impl.store.SessionStore.create(ServiceRegistry.getInstance());
            OmniChannelSession session = omniSessionStore.loadSession(sessionKey);
            if (session == null) {
                LOGGER.warn("#####-CHATBOT POOL extend-timeout: session not found for accountId={} sessionKey={}",
                        accountId, sessionKey);
                return;
            }
            long futureMs = System.currentTimeMillis() + POOL_ENTRY_TIMESTAMP_BUFFER_MS;
            session.setLastMessageReceivedTime(futureMs);
            omniSessionStore.saveSession(session);
        } catch (Exception cause) {
            LOGGER.warn("#####-CHATBOT POOL extend-timeout failed for accountId={}", accountId, cause);
        }
    }

    private static final class StoredEntry {
        String body;
        String accountId;
        String inboxId;
    }

}
