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

package app.krista.extensions.essentials.collaboration.omnichatbot.concurrency;

import app.krista.extension.executor.Invoker;
import app.krista.extensions.essentials.collaboration.omnichatbot.resource.dto.QueuedLoginResponse;
import app.krista.ksdk.telemetry.TelemetryMetrics;
import com.kristasoft.common.holders.ThreadLocalProxy;
import org.jvnet.hk2.annotations.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.inject.Inject;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Central orchestrator for the concurrent-user rate-limiting and FIFO queue.
 *
 * <p>In the queue-gated login design, admission is checked inside the
 * {@code /authn/login} endpoint — there is no separate admission API. The
 * manager exposes {@link #checkLoginAdmission(Long)} for the login endpoint
 * and WS lifecycle hooks ({@code onWsOpened/onWsClosed/onWsPing}) for active
 * seat tracking.
 *
 * <p>Everything is a no-op unless {@link ConcurrencyConfig#isEnabled()} is true,
 * and every public entry point <b>fails open</b> (admit the user) if the
 * underlying store throws.
 *
 * <p>Slots use a grace period: when the last WS tab closes, the slot is kept
 * with refcount=0 for {@code SLOT_STALE_MS} so a transient network blip or
 * page refresh does not lose the seat. The background reaper frees stale
 * grace-period slots and prunes abandoned queue tickets.
 */
@Service
public class ConcurrencyManager {

    private static final Logger LOGGER = LoggerFactory.getLogger(ConcurrencyManager.class);

    private final SlotStore slotStore;
    private final QueueStore queueStore;
    private final ConcurrencyConfig config;
    private final WaitTimeEstimator estimator;
    private final TelemetryMetrics telemetry;
    private final Map<String, String> metricAttributes;

    private final AtomicBoolean reaperRunning = new AtomicBoolean(false);
    private volatile Thread reaperThread;

    private final AtomicLong tokenGenerator = new AtomicLong(0);
    private final AtomicInteger pendingAdmissions = new AtomicInteger(0);

    @Inject
    public ConcurrencyManager(SlotStore slotStore, QueueStore queueStore, ConcurrencyConfig config,
            WaitTimeEstimator estimator, TelemetryMetrics telemetry, Invoker invoker) {
        this.slotStore = slotStore;
        this.queueStore = queueStore;
        this.config = config;
        this.estimator = estimator;
        this.telemetry = telemetry;
        this.metricAttributes = Map.of("invoker_id", invoker.getInvokerId());
    }

    // ---- login-facing admission check ----

    /**
     * Called by the login endpoint to decide whether to admit the caller or
     * queue them. Returns {@code null} when the caller is admitted (proceed
     * with normal login), or a {@link QueuedLoginResponse} when they must wait.
     *
     * <p>Strict FIFO: only the queue head is admitted when seats are free. A
     * new user with no token is admitted only if the queue is empty AND seats
     * are available. Otherwise they receive a new queue token.
     *
     * @param queueToken the token from a previous queue response, or {@code null}
     *                   for a first-time caller.
     * @return {@code null} if admitted, or a queue response with position/wait info.
     */
    public synchronized QueuedLoginResponse checkLoginAdmission(Long queueToken) {
        if (!config.isEnabled()) {
            return null;
        }
        try {
            long now = System.currentTimeMillis();
            String tokenKey = queueToken != null ? Long.toString(queueToken) : null;

            if (tokenKey != null && queueStore.contains(tokenKey)) {
                queueStore.touch(tokenKey, now);
                if (hasRoom()) {
                    queueStore.pruneStale();
                    String head = queueStore.peekHead();
                    if (head != null && head.equals(tokenKey)) {
                        queueStore.remove(tokenKey);
                        pendingAdmissions.incrementAndGet();
                        telemetry.incrementCounter(ConcurrencyConstants.METRIC_ADMITTED, 1, metricAttributes);
                        observeGauges();
                        return null;
                    }
                }
                int position = queueStore.position(tokenKey);
                long waitMs = estimator.estimateWaitMillis(position, config.maxConcurrentUsers());
                return new QueuedLoginResponse(queueToken, position, waitMs,
                        ConcurrencyConstants.QUEUE_POLL_INTERVAL_MS);
            }

            if (tokenKey != null) {
                if (hasRoom()) {
                    pendingAdmissions.incrementAndGet();
                    telemetry.incrementCounter(ConcurrencyConstants.METRIC_ADMITTED, 1, metricAttributes);
                    observeGauges();
                    return null;
                }
                queueStore.requeueAtFront(tokenKey, now);
                int position = queueStore.position(tokenKey);
                long waitMs = estimator.estimateWaitMillis(position, config.maxConcurrentUsers());
                observeGauges();
                return new QueuedLoginResponse(queueToken, position, waitMs,
                        ConcurrencyConstants.QUEUE_POLL_INTERVAL_MS);
            }

            if (hasRoom() && queueStore.depth() == 0) {
                pendingAdmissions.incrementAndGet();
                telemetry.incrementCounter(ConcurrencyConstants.METRIC_ADMITTED, 1, metricAttributes);
                return null;
            }

            long newToken = tokenGenerator.incrementAndGet();
            persistTokenSequence(newToken);
            String newTokenKey = Long.toString(newToken);
            if (queueStore.authoritativeDepth() >= ConcurrencyConstants.QUEUE_SAFETY_CEILING) {
                LOGGER.warn("#####-CHATBOT-CONCURRENCY queue safety ceiling ({}) exceeded; investigate capacity/abuse",
                        ConcurrencyConstants.QUEUE_SAFETY_CEILING);
            }
            queueStore.enqueue(newTokenKey, now);
            telemetry.incrementCounter(ConcurrencyConstants.METRIC_QUEUED, 1, metricAttributes);
            int position = queueStore.position(newTokenKey);
            long waitMs = estimator.estimateWaitMillis(position, config.maxConcurrentUsers());
            observeGauges();
            return new QueuedLoginResponse(newToken, position, waitMs,
                    ConcurrencyConstants.QUEUE_POLL_INTERVAL_MS);
        } catch (Exception cause) {
            return failOpen("checkLoginAdmission", cause);
        }
    }

    /** Returns {@code true} if the account currently holds a slot with active connections (refcount > 0). */
    public boolean hasActiveSlot(String accountId) {
        if (!config.isEnabled() || accountId == null || accountId.isBlank()) {
            return false;
        }
        try {
            return slotStore.hasSlot(accountId);
        } catch (Exception cause) {
            LOGGER.warn("#####-CHATBOT-CONCURRENCY hasActiveSlot failed for {}: {}", accountId, cause.getMessage());
            return false;
        }
    }

    public boolean isEnabled() {
        return config.isEnabled();
    }

    /** The account left the queue or disconnected (idle timeout / tab close). */
    public void leaveQueue(String tokenOrAccountId) {
        if (!config.isEnabled()) {
            return;
        }
        try {
            queueStore.remove(tokenOrAccountId);
            observeGauges();
        } catch (Exception cause) {
            LOGGER.warn("#####-CHATBOT-CONCURRENCY leaveQueue failed for {}: {}", tokenOrAccountId, cause.getMessage());
        }
    }

    // ---- WS lifecycle hooks (keyed by accountId) ----

    /** A chat WS opened: refresh the heartbeat so the reaper knows the session is alive. */
    public void onWsOpened(String accountId) {
        if (!config.isEnabled() || accountId == null || accountId.isBlank()) {
            return;
        }
        try {
            slotStore.heartbeat(accountId, System.currentTimeMillis());
        } catch (Exception cause) {
            LOGGER.warn("#####-CHATBOT-CONCURRENCY onWsOpened failed for {}: {}", accountId, cause.getMessage());
        }
    }

    /**
     * A chat WS closed. The seat stays occupied — it is only freed by an
     * explicit logout ({@link #releaseSlot}) or by the background reaper when
     * the heartbeat goes stale (browser close / network loss).
     */
    public void onWsClosed(String accountId) {
        if (!config.isEnabled() || accountId == null || accountId.isBlank()) {
            return;
        }
    }

    /**
     * Immediately releases the concurrency seat for the account, bypassing the
     * grace period. Called by the logout endpoint on idle-disconnect so the seat
     * is freed instantly for the next queued user.
     */
    public void releaseSlot(String accountId) {
        if (!config.isEnabled() || accountId == null || accountId.isBlank()) {
            return;
        }
        try {
            long firstAcquired = slotStore.slotFirstAcquired(accountId);
            long now = System.currentTimeMillis();
            slotStore.removeSlot(accountId);
            recordSessionDurationIfEngaged(firstAcquired, now);
            observeGauges();
        } catch (Exception cause) {
            LOGGER.warn("#####-CHATBOT-CONCURRENCY releaseSlot failed for {}: {}", accountId, cause.getMessage());
        }
    }

    /**
     * Occupies a concurrency seat for the given account. Called right after
     * the login API returns user data so the map reflects the seat immediately.
     */
    public void acquireSlot(String accountId) {
        if (!config.isEnabled() || accountId == null || accountId.isBlank()) {
            return;
        }
        pendingAdmissions.updateAndGet(v -> Math.max(0, v - 1));
        try {
            long now = System.currentTimeMillis();
            slotStore.acquireConnection(accountId, now);
            observeGauges();
        } catch (Exception cause) {
            LOGGER.warn("#####-CHATBOT-CONCURRENCY acquireSlot failed for {}: {}", accountId, cause.getMessage());
        }
    }

    /** A WS ping arrived: refresh the slot heartbeat so the reaper keeps it alive. */
    public void onWsPing(String accountId) {
        if (!config.isEnabled() || accountId == null || accountId.isBlank()) {
            return;
        }
        try {
            slotStore.heartbeat(accountId, System.currentTimeMillis());
        } catch (Exception cause) {
            LOGGER.warn("#####-CHATBOT-CONCURRENCY onWsPing failed for {}: {}", accountId, cause.getMessage());
        }
    }

    // ---- lifecycle ----

    public void start() {
        if (!reaperRunning.compareAndSet(false, true)) {
            return;
        }
        Map<Class<?>, Object> threadLocals = ThreadLocalProxy.getAll();
        reaperThread = Thread.startVirtualThread(() -> {
            ThreadLocalProxy.setAll(threadLocals);
            while (reaperRunning.get()) {
                try {
                    Thread.sleep(ConcurrencyConstants.REAPER_INTERVAL_MS);
                } catch (InterruptedException interrupted) {
                    if (!reaperRunning.get()) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
                sweep();
            }
        });
    }

    public void shutdown() {
        if (reaperRunning.compareAndSet(true, false)) {
            Thread thread = reaperThread;
            if (thread != null) {
                thread.interrupt();
            }
        }
    }

    /** Rebuilds the local queue read-cache and re-seeds the token generator. */
    public void rehydrate() {
        try {
            queueStore.rehydrate();
            reseedTokenGenerator();
        } catch (Exception cause) {
            LOGGER.warn("#####-CHATBOT-CONCURRENCY rehydrate failed: {}", cause.getMessage());
        }
    }

    void reapForTest() {
        sweep();
    }

    // ---- internals ----

    private void sweep() {
        if (!config.isEnabled()) {
            return;
        }
        try {
            pendingAdmissions.set(0);
            queueStore.rehydrate();
            long now = System.currentTimeMillis();
            reclaimStaleSlots(now);
            queueStore.pruneStale();
            observeGauges();
        } catch (Exception cause) {
            LOGGER.warn("#####-CHATBOT-CONCURRENCY reaper sweep error: {}", cause.getMessage());
        }
    }

    private void reclaimStaleSlots(long now) {
        long staleBefore = now - ConcurrencyConstants.SLOT_STALE_MS;
        for (SlotStore.SlotSnapshot slot : slotStore.allSlots()) {
            if (slot.lastSeen() < staleBefore) {
                slotStore.removeSlot(slot.accountId());
                LOGGER.info("#####-CHATBOT-CONCURRENCY reclaimed stale slot for {} (refcount={}, stale heartbeat)",
                        slot.accountId(), slot.refcount());
            }
        }
    }

    private boolean hasRoom() {
        return slotStore.activeSlotCount() + pendingAdmissions.get() < config.maxConcurrentUsers();
    }

    private void recordSessionDurationIfEngaged(long firstAcquired, long now) {
        if (firstAcquired <= 0) {
            return;
        }
        long duration = now - firstAcquired;
        if (duration < config.idleDisconnectSeconds() * 1000L) {
            estimator.recordSessionDuration(duration);
        }
        telemetry.recordDuration(ConcurrencyConstants.METRIC_SESSION_DURATION_MS, duration, metricAttributes);
    }

    private void observeGauges() {
        try {
            telemetry.observeGauge(ConcurrencyConstants.METRIC_ACTIVE, slotStore.activeSlotCount(), metricAttributes);
            telemetry.observeGauge(ConcurrencyConstants.METRIC_QUEUE_DEPTH, queueStore.depth(), metricAttributes);
        } catch (Exception cause) {
            LOGGER.debug("#####-CHATBOT-CONCURRENCY gauge observe failed: {}", cause.getMessage());
        }
    }

    private QueuedLoginResponse failOpen(String op, Exception cause) {
        LOGGER.warn("#####-CHATBOT-CONCURRENCY {} failed; failing OPEN (admitting): {}", op, cause.getMessage());
        try {
            telemetry.incrementCounter(ConcurrencyConstants.METRIC_REJECTED_FAILOPEN, 1, metricAttributes);
        } catch (Exception ignored) {
        }
        return null;
    }

    private void persistTokenSequence(long value) {
        try {
            slotStore.getStore().put(ConcurrencyConstants.TOKEN_GENERATOR_KEY, Long.toString(value));
        } catch (Exception cause) {
            LOGGER.debug("#####-CHATBOT-CONCURRENCY failed persisting token sequence: {}", cause.getMessage());
        }
    }

    private void reseedTokenGenerator() {
        try {
            Object raw = slotStore.getStore().get(ConcurrencyConstants.TOKEN_GENERATOR_KEY);
            if (raw != null) {
                long persisted = Long.parseLong(raw.toString().trim());
                tokenGenerator.set(persisted);
            }
        } catch (Exception cause) {
            LOGGER.warn("#####-CHATBOT-CONCURRENCY failed reseeding token generator: {}", cause.getMessage());
        }
    }
}
