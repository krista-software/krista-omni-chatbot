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

package app.krista.extensions.essentials.collaboration.omnichatbot.audit;

import app.krista.extension.executor.Invoker;
import app.krista.extensions.essentials.collaboration.omnichatbot.concurrency.ConcurrencyManager;
import app.krista.extensions.essentials.collaboration.omnichatbot.concurrency.QueueStore;
import app.krista.extensions.util.KeyValueStore;
import org.jvnet.hk2.annotations.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.inject.Inject;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Facade for all chatbot audit/analytics operations: incrementing time-bucketed
 * counters, tracking live presence, and serving the read-only analytics REST API.
 *
 * <p>Every write method is fire-and-forget (wrapped in try/catch) — a KVS failure
 * must never disrupt the chat flow.
 */
@Service
public class AuditService {

    private static final Logger LOGGER = LoggerFactory.getLogger(AuditService.class);

    // ---- metric keys ----
    static final String METRIC_MSG_USER = "msg-user";
    static final String METRIC_MSG_BOT = "msg-bot";
    static final String METRIC_SESSIONS_NEW = "sessions-new";
    static final String METRIC_SESSIONS_RET = "sessions-ret";

    // ---- last-activity event type labels ----
    public static final String EVENT_SESSION_STARTED = "SESSION_STARTED";
    public static final String EVENT_SESSION_ENDED = "SESSION_ENDED";
    public static final String EVENT_WS_CONNECTED = "WS_CONNECTED";
    public static final String EVENT_WS_DISCONNECTED = "WS_DISCONNECTED";
    public static final String EVENT_USER_MESSAGE = "USER_MESSAGE";
    public static final String EVENT_FORM_SUBMITTED = "FORM_SUBMITTED";
    public static final String EVENT_BOT_MESSAGE = "BOT_MESSAGE";
    public static final String EVENT_CONFIG_CHANGED = "CONFIG_CHANGED";
    public static final String EVENT_USER_QUEUED = "USER_QUEUED";

    private static final String LAST_ACTIVITY_PREFIX = "aud-last-";
    // Live-presence heartbeat, refreshed on every WS ping (client pings ~every 10s).
    private static final String PRESENCE_PREFIX = "aud-presence-";
    // A user counts as "active now" if their heartbeat is within this window.
    private static final long PRESENCE_ACTIVE_MS = 90_000L;
    // Heartbeats older than this are deleted during the reaper scan, so an
    // ungracefully dropped connection can never leak forever.
    private static final long PRESENCE_PRUNE_MS = 600_000L;
    // The reaper also runs (throttled) on the ping path, so stale presence keys are
    // cleaned whenever there is ANY traffic — not only when an admin views the tab.
    private static final long PRESENCE_PRUNE_INTERVAL_MS = 60_000L;

    private static final long HOUR_MS = 3_600_000L;
    private static final long DAY_MS = 86_400_000L;

    private static final DateTimeFormatter BUCKET_DAY_FMT = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final DateTimeFormatter BUCKET_HOUR_FMT = DateTimeFormatter.ofPattern("yyyyMMddHH");
    private static final DateTimeFormatter DAY_LABEL_FMT = DateTimeFormatter.ofPattern("MMM d");
    private static final DateTimeFormatter HOUR_LABEL_FMT = DateTimeFormatter.ofPattern("HH:00");

    private final AuditCounterStore counterStore;
    private final String invokerId;
    private final QueueStore queueStore;
    private final ConcurrencyManager concurrencyManager;
    private final KeyValueStore keyValueStore;
    // Throttles the presence reaper on the hot ping path to at most once per interval.
    private final AtomicLong lastPresencePruneAt = new AtomicLong(0);

    @Inject
    public AuditService(Invoker invoker, KeyValueStore keyValueStore,
            QueueStore queueStore, ConcurrencyManager concurrencyManager) {
        this.invokerId = invoker.getInvokerId();
        this.keyValueStore = keyValueStore;
        this.counterStore = new AuditCounterStore(keyValueStore, invokerId);
        this.queueStore = queueStore;
        this.concurrencyManager = concurrencyManager;
    }

    // ---- write API (all fire-and-forget) ----

    public void recordNewSession() {
        long now = System.currentTimeMillis();
        try {
            counterStore.increment(METRIC_SESSIONS_NEW, now);
            touchLastActivity(EVENT_SESSION_STARTED, now);
        } catch (Exception e) {
            LOGGER.warn("#####-CHATBOT-AUDIT recordNewSession failed: {}", e.getMessage());
        }
    }

    public void recordReturningSession() {
        long now = System.currentTimeMillis();
        try {
            counterStore.increment(METRIC_SESSIONS_RET, now);
            touchLastActivity(EVENT_SESSION_STARTED, now);
        } catch (Exception e) {
            LOGGER.warn("#####-CHATBOT-AUDIT recordReturningSession failed: {}", e.getMessage());
        }
    }

    public void recordUserMessage() {
        long now = System.currentTimeMillis();
        try {
            counterStore.increment(METRIC_MSG_USER, now);
            touchLastActivity(EVENT_USER_MESSAGE, now);
        } catch (Exception e) {
            LOGGER.warn("#####-CHATBOT-AUDIT recordUserMessage failed: {}", e.getMessage());
        }
    }

    public void recordFormSubmitted() {
        long now = System.currentTimeMillis();
        try {
            counterStore.increment(METRIC_MSG_USER, now);
            touchLastActivity(EVENT_FORM_SUBMITTED, now);
        } catch (Exception e) {
            LOGGER.warn("#####-CHATBOT-AUDIT recordFormSubmitted failed: {}", e.getMessage());
        }
    }

    public void recordBotMessages(int count) {
        if (count <= 0) {
            return;
        }
        long now = System.currentTimeMillis();
        try {
            for (int i = 0; i < count; i++) {
                counterStore.increment(METRIC_MSG_BOT, now);
            }
            touchLastActivity(EVENT_BOT_MESSAGE, now);
        } catch (Exception e) {
            LOGGER.warn("#####-CHATBOT-AUDIT recordBotMessages failed: {}", e.getMessage());
        }
    }

    public void recordWsConnected() {
        try {
            touchLastActivity(EVENT_WS_CONNECTED, System.currentTimeMillis());
        } catch (Exception e) {
            LOGGER.warn("#####-CHATBOT-AUDIT recordWsConnected failed: {}", e.getMessage());
        }
    }

    public void recordWsDisconnected() {
        try {
            touchLastActivity(EVENT_WS_DISCONNECTED, System.currentTimeMillis());
        } catch (Exception e) {
            LOGGER.warn("#####-CHATBOT-AUDIT recordWsDisconnected failed: {}", e.getMessage());
        }
    }

    public void recordSessionEnded(String reason) {
        try {
            touchLastActivity(EVENT_SESSION_ENDED, System.currentTimeMillis());
        } catch (Exception e) {
            LOGGER.warn("#####-CHATBOT-AUDIT recordSessionEnded failed: {}", e.getMessage());
        }
    }

    public void recordConfigChanged() {
        try {
            touchLastActivity(EVENT_CONFIG_CHANGED, System.currentTimeMillis());
        } catch (Exception e) {
            LOGGER.warn("#####-CHATBOT-AUDIT recordConfigChanged failed: {}", e.getMessage());
        }
    }

    public void recordUserQueued() {
        try {
            touchLastActivity(EVENT_USER_QUEUED, System.currentTimeMillis());
        } catch (Exception e) {
            LOGGER.warn("#####-CHATBOT-AUDIT recordUserQueued failed: {}", e.getMessage());
        }
    }

    // ---- live presence (heartbeat-based active-user tracking) ----

    /**
     * Records/refreshes a user's presence heartbeat. Called on WS open and on every
     * WS ping, so an active user's heartbeat stays fresh and a dead connection's
     * heartbeat goes stale (and stops being counted) within {@link #PRESENCE_ACTIVE_MS}.
     */
    public void recordPresence(String accountId) {
        if (accountId == null) {
            return;
        }
        long now = System.currentTimeMillis();
        try {
            keyValueStore.put(presenceKey(accountId), String.valueOf(now));
            maybePrunePresence(now);
        } catch (Exception e) {
            LOGGER.warn("#####-CHATBOT-AUDIT recordPresence failed: {}", e.getMessage());
        }
    }

    /** Removes a user's presence heartbeat on graceful WS close. */
    public void removePresence(String accountId) {
        if (accountId == null) {
            return;
        }
        try {
            keyValueStore.remove(presenceKey(accountId));
        } catch (Exception e) {
            LOGGER.warn("#####-CHATBOT-AUDIT removePresence failed: {}", e.getMessage());
        }
    }

    // ---- read API ----

    /**
     * Returns KPI counters for the requested range, plus the "users created"
     * figures (last hour / 24h / 30d) and the new-user trend series (hourly &amp;
     * daily) that back the analytics graph.
     *
     * @param range one of {@code 1h}, {@code 6h}, {@code 24h}, {@code 7d}, {@code 30d}
     */
    public AuditSummaryDto getSummary(String range) {
        long now = System.currentTimeMillis();
        RangeWindow window = RangeWindow.parse(range, now);
        boolean useHourly = window.useHourly();

        long userMessages = sum(METRIC_MSG_USER, window.fromMs(), now, useHourly);
        long botMessages = sum(METRIC_MSG_BOT, window.fromMs(), now, useHourly);
        long newSessions = sum(METRIC_SESSIONS_NEW, window.fromMs(), now, useHourly);
        long returningSessions = sum(METRIC_SESSIONS_RET, window.fromMs(), now, useHourly);
        long userMessagesPrev = sum(METRIC_MSG_USER, window.prevFromMs(), window.fromMs(), useHourly);
        long newSessionsPrev = sum(METRIC_SESSIONS_NEW, window.prevFromMs(), window.fromMs(), useHourly);

        // "Users created" quick figures — always the same three windows, independent
        // of the selected range, so the admin can glance hour/day/month at once.
        long newUsersLastHour = counterStore.sumHourly(METRIC_SESSIONS_NEW, now - HOUR_MS, now);
        long newUsersLast24h = counterStore.sumHourly(METRIC_SESSIONS_NEW, now - 24 * HOUR_MS, now);
        long newUsersLast30d = counterStore.sumDaily(METRIC_SESSIONS_NEW, now - 30 * DAY_MS, now);

        List<AuditSummaryDto.SeriesPoint> newUsersHourly = buildSeries(counterStore.chartHours(METRIC_SESSIONS_NEW, 24), true);
        List<AuditSummaryDto.SeriesPoint> newUsersDaily = buildSeries(counterStore.chartDays(METRIC_SESSIONS_NEW, 30), false);

        return new AuditSummaryDto(range, userMessages, botMessages, newSessions, returningSessions,
                userMessagesPrev, newSessionsPrev,
                newUsersLastHour, newUsersLast24h, newUsersLast30d,
                newUsersHourly, newUsersDaily);
    }

    /** Returns live active-user count, queue depth, and last-activity info. */
    public AuditStatusDto getStatus() {
        int activeUsers = activePresenceCount();
        int queueDepth = (concurrencyManager != null && concurrencyManager.isEnabled())
                ? queueStore.depth() : 0;
        Object lastRaw = keyValueStore.get(LAST_ACTIVITY_PREFIX + invokerId);
        Long lastActivityAt = null;
        String lastEventType = null;
        if (lastRaw != null) {
            String[] parts = lastRaw.toString().split("\\|", 2);
            try {
                lastActivityAt = Long.parseLong(parts[0]);
            } catch (NumberFormatException ignored) {
            }
            if (parts.length > 1) {
                lastEventType = parts[1];
            }
        }
        return new AuditStatusDto(activeUsers, queueDepth, lastActivityAt, lastEventType);
    }

    // ---- private helpers ----

    private void touchLastActivity(String type, long nowMs) {
        keyValueStore.put(LAST_ACTIVITY_PREFIX + invokerId, nowMs + "|" + type);
    }

    private String presenceKey(String accountId) {
        return PRESENCE_PREFIX + invokerId + "-" + accountId;
    }

    /**
     * Runs the presence reaper at most once per {@link #PRESENCE_PRUNE_INTERVAL_MS},
     * regardless of how many pings arrive. Called from the hot ping path so stale
     * heartbeats are cleaned under any traffic — not only when the audit tab is open.
     */
    private void maybePrunePresence(long now) {
        long last = lastPresencePruneAt.get();
        if (now - last >= PRESENCE_PRUNE_INTERVAL_MS && lastPresencePruneAt.compareAndSet(last, now)) {
            try {
                activePresenceCount();
            } catch (Exception ignored) {
                // best-effort cleanup; never disrupt the ping path
            }
        }
    }

    /**
     * Counts presence heartbeats stamped within {@link #PRESENCE_ACTIVE_MS} and
     * deletes heartbeats older than {@link #PRESENCE_PRUNE_MS}.
     */
    private int activePresenceCount() {
        long now = System.currentTimeMillis();
        String prefix = PRESENCE_PREFIX + invokerId + "-";
        int count = 0;
        List<String> stale = new ArrayList<>();
        for (String key : keyValueStore.getKeys()) {
            if (key == null || !key.startsWith(prefix)) {
                continue;
            }
            long age = now - parseTimestamp(keyValueStore.get(key));
            if (age <= PRESENCE_ACTIVE_MS) {
                count++;
            } else if (age > PRESENCE_PRUNE_MS) {
                stale.add(key);
            }
        }
        stale.forEach(keyValueStore::remove);
        return count;
    }

    private static long parseTimestamp(Object value) {
        if (value == null) {
            return 0L;
        }
        try {
            return Long.parseLong(value.toString());
        } catch (NumberFormatException e) {
            return 0L;
        }
    }

    private long sum(String metric, long fromMs, long toMs, boolean hourly) {
        return hourly
                ? counterStore.sumHourly(metric, fromMs, toMs)
                : counterStore.sumDaily(metric, fromMs, toMs);
    }

    private static List<AuditSummaryDto.SeriesPoint> buildSeries(Map<String, Long> buckets, boolean hourly) {
        List<AuditSummaryDto.SeriesPoint> series = new ArrayList<>(buckets.size());
        for (Map.Entry<String, Long> e : buckets.entrySet()) {
            String label = hourly ? formatHourLabel(e.getKey()) : formatDayLabel(e.getKey());
            series.add(new AuditSummaryDto.SeriesPoint(label, e.getValue()));
        }
        return series;
    }

    // Backend-formatted labels (UTC) so the browser never has to parse a date —
    // this is what previously produced "Invalid Date" on the chart.
    private static String formatDayLabel(String yyyymmdd) {
        try {
            return LocalDate.parse(yyyymmdd, BUCKET_DAY_FMT).format(DAY_LABEL_FMT);
        } catch (Exception e) {
            return yyyymmdd;
        }
    }

    private static String formatHourLabel(String yyyymmddhh) {
        try {
            return LocalDateTime.parse(yyyymmddhh + "00", DateTimeFormatter.ofPattern("yyyyMMddHHmm"))
                    .format(HOUR_LABEL_FMT);
        } catch (Exception e) {
            return yyyymmddhh;
        }
    }

    // ---- range window helper ----

    private record RangeWindow(long fromMs, long prevFromMs, boolean useHourly) {
        static RangeWindow parse(String range, long nowMs) {
            return switch (range) {
                case "1h" -> new RangeWindow(nowMs - HOUR_MS, nowMs - 2 * HOUR_MS, true);
                case "6h" -> new RangeWindow(nowMs - 6 * HOUR_MS, nowMs - 12 * HOUR_MS, true);
                case "7d" -> new RangeWindow(nowMs - 7 * DAY_MS, nowMs - 14 * DAY_MS, false);
                case "30d" -> new RangeWindow(nowMs - 30 * DAY_MS, nowMs - 60 * DAY_MS, false);
                default -> new RangeWindow(nowMs - 24 * HOUR_MS, nowMs - 48 * HOUR_MS, true); // 24h
            };
        }
    }

    // ---- public DTO records (serialised to JSON by AuditResource) ----

    public record AuditSummaryDto(
            String range,
            long userMessages,
            long botMessages,
            long newSessions,
            long returningSessions,
            long userMessagesPrev,
            long newSessionsPrev,
            long newUsersLastHour,
            long newUsersLast24h,
            long newUsersLast30d,
            List<SeriesPoint> newUsersHourly,
            List<SeriesPoint> newUsersDaily) {
        public record SeriesPoint(String label, long value) {
        }
    }

    public record AuditStatusDto(int activeUsers, int queueDepth, Long lastActivityAt, String lastEventType) {
    }
}
