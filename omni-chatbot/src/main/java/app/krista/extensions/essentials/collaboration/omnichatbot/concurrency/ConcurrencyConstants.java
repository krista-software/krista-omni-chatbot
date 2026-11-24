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

/**
 * Internal, non-admin-editable constants for the concurrent-user rate-limiting
 * and idle-session feature. Only three values are admin-configurable (see
 * {@link ConcurrencyConfig}); everything else lives here and changes only via an
 * extension upgrade.
 *
 * <p>The whole feature is gated behind the {@code concurrencyControlEnabled}
 * master flag; when that flag is off none of these values are consulted.
 */
public final class ConcurrencyConstants {

    private ConcurrencyConstants() {
        throw new IllegalStateException("Invalid access to utility class.");
    }

    // ---- uiConfigJson keys (the 3 admin-facing settings) ----
    public static final String KEY_ENABLED = "concurrencyControlEnabled";
    public static final String KEY_MAX_CONCURRENT_USERS = "maxConcurrentUsers";
    public static final String KEY_IDLE_DISCONNECT_SECONDS = "idleDisconnectSeconds";

    // ---- admin-setting defaults / clamps ----
    public static final int DEFAULT_MAX_CONCURRENT_USERS = 250;
    public static final int MIN_MAX_CONCURRENT_USERS = 1;
    public static final int DEFAULT_IDLE_DISCONNECT_SECONDS = 300;
    public static final int MIN_IDLE_DISCONNECT_SECONDS = 30;

    // ---- internal tuning constants ----
    // Frontend queue-position poll interval. Surfaced to the FE inside /config so
    // there is a single source of truth, but it is not admin-editable.
    public static final int QUEUE_POLL_INTERVAL_MS = 5000;
    // Seed/fallback for the wait estimate until the rolling estimator has enough
    // real session-duration samples.
    public static final int AVG_SESSION_DURATION_SECONDS_SEED = 180;
    // Token generator KVS key — stores the last issued queue token so a restart
    // does not reuse tokens that may still be in the queue.
    public static final String TOKEN_GENERATOR_KEY = "__cc_token_seq__";
    // Hard cap on the idle-warning lead; the actual lead is min(this, idleDisconnect/2)
    // so a low idleDisconnect can never produce an invalid (>= disconnect) lead.
    public static final int IDLE_WARNING_LEAD_CAP_SECONDS = 120;

    // ---- reaper / staleness windows ----
    // How often the background reaper sweeps for leaked slots and abandoned tickets.
    public static final long REAPER_INTERVAL_MS = 5000L;
    // An active slot whose heartbeat (refreshed off WS ping) is older than this is
    // treated as leaked (node crash / abrupt close) and reclaimed. ~3 missed pings
    // at the 10s ping interval.
    public static final long SLOT_STALE_MS = 30000L;
    // A queue ticket not polled (status check) within this window is treated as
    // abandoned (tab closed / navigated away) and pruned. 18x the poll interval —
    // generous to tolerate browser throttling and network hiccups without losing
    // the user's FIFO position.
    public static final long QUEUE_TICKET_STALE_MS = 90000L;
    // Safety ceiling on queue size. The product intent is "unlimited", but this
    // guards the shared store against runaway growth / abuse; breaches are logged
    // and metered, not used as a product-facing cap under normal load.
    public static final int QUEUE_SAFETY_CEILING = 10000;

    // ---- shared KeyValueStore key prefixes ----
    // The injected KeyValueStore is shared with ConnectionStore (which uses bare
    // accountId keys), so every concurrency key is namespaced to avoid collisions.
    public static final String SLOT_KEY_PREFIX = "__cc_slot__:";
    public static final String QUEUE_KEY_PREFIX = "__cc_queue__:";
    public static final String SESSION_SAMPLE_KEY = "__cc_session_avg__";

    // ---- telemetry metric names ----
    public static final String METRIC_ACTIVE = "chatbot.concurrency.active";
    public static final String METRIC_QUEUE_DEPTH = "chatbot.concurrency.queue_depth";
    public static final String METRIC_ADMITTED = "chatbot.concurrency.admitted";
    public static final String METRIC_QUEUED = "chatbot.concurrency.queued";
    public static final String METRIC_REJECTED_FAILOPEN = "chatbot.concurrency.rejected_failopen";
    public static final String METRIC_IDLE_DISCONNECT = "chatbot.concurrency.idle_disconnect";
    public static final String METRIC_WAIT_MS = "chatbot.concurrency.wait_ms";
    public static final String METRIC_SESSION_DURATION_MS = "chatbot.concurrency.session_duration_ms";
}
