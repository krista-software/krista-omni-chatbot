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

import app.krista.extensions.util.KeyValueStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Time-bucketed counter store for audit metrics, backed by the shared
 * {@link KeyValueStore} (Infinispan). Each metric is stored in two
 * granularities simultaneously:
 * <ul>
 *   <li>Hourly buckets — retained for 7 days; enables sub-day range queries.</li>
 *   <li>Daily buckets — retained for 90 days; enables the 7-day and 30-day charts.</li>
 * </ul>
 *
 * <p>Stale buckets are pruned deterministically on every write: when a bucket for
 * time T is written, the bucket exactly (retention + 1) periods in the past is
 * removed. No scan is required — the stale key is computed directly.
 *
 * <p>Accuracy: read-modify-write is not atomic. On a multi-node cluster two
 * concurrent writes to the same bucket may lose one increment. For analytics
 * (not billing) this ±1% tolerance is acceptable.
 */
class AuditCounterStore {

    private static final Logger LOGGER = LoggerFactory.getLogger(AuditCounterStore.class);
    private static final DateTimeFormatter HOURLY_FMT =
            DateTimeFormatter.ofPattern("yyyyMMddHH").withZone(ZoneOffset.UTC);
    private static final DateTimeFormatter DAILY_FMT =
            DateTimeFormatter.ofPattern("yyyyMMdd").withZone(ZoneOffset.UTC);
    private static final String PREFIX = "aud-cnt-";
    // Prune buckets that just left the retention window on every write.
    // 169h = 7 days + 1h buffer so the current hour is never accidentally removed.
    private static final long HOURLY_RETENTION_HOURS = 169;
    private static final long DAILY_RETENTION_DAYS = 91;

    private final KeyValueStore store;
    private final String invokerId;

    AuditCounterStore(KeyValueStore store, String invokerId) {
        this.store = store;
        this.invokerId = invokerId;
    }

    /**
     * Increments both the hourly and daily bucket for {@code metric} at
     * {@code nowMs}, then deterministically prunes the bucket that just fell
     * outside the retention window.
     */
    void increment(String metric, long nowMs) {
        Instant instant = Instant.ofEpochMilli(nowMs);
        incrementBucketKey(bucketKey(metric, HOURLY_FMT.format(instant)));
        incrementBucketKey(bucketKey(metric, DAILY_FMT.format(instant)));
        store.remove(bucketKey(metric, HOURLY_FMT.format(instant.minus(HOURLY_RETENTION_HOURS, ChronoUnit.HOURS))));
        store.remove(bucketKey(metric, DAILY_FMT.format(instant.minus(DAILY_RETENTION_DAYS, ChronoUnit.DAYS))));
    }

    /**
     * Sums the hourly buckets for {@code metric} in [{@code fromMs}, {@code toMs}].
     * Used for ranges ≤ 24 h (1h, 6h, 24h).
     */
    long sumHourly(String metric, long fromMs, long toMs) {
        long total = 0;
        Instant cursor = Instant.ofEpochMilli(fromMs).truncatedTo(ChronoUnit.HOURS);
        Instant end = Instant.ofEpochMilli(toMs);
        while (!cursor.isAfter(end)) {
            total += readBucket(metric, HOURLY_FMT.format(cursor));
            cursor = cursor.plus(1, ChronoUnit.HOURS);
        }
        return total;
    }

    /**
     * Sums the daily buckets for {@code metric} in [{@code fromMs}, {@code toMs}].
     * Used for ranges ≥ 7 d (7d, 30d).
     */
    long sumDaily(String metric, long fromMs, long toMs) {
        long total = 0;
        Instant cursor = Instant.ofEpochMilli(fromMs).truncatedTo(ChronoUnit.DAYS);
        Instant end = Instant.ofEpochMilli(toMs);
        while (!cursor.isAfter(end)) {
            total += readBucket(metric, DAILY_FMT.format(cursor));
            cursor = cursor.plus(1, ChronoUnit.DAYS);
        }
        return total;
    }

    /**
     * Returns a date → count map for the last {@code days} calendar days (UTC),
     * newest last. Used for the 7-day bar chart.
     */
    Map<String, Long> chartDays(String metric, int days) {
        Map<String, Long> result = new LinkedHashMap<>();
        Instant now = Instant.now();
        for (int i = days - 1; i >= 0; i--) {
            Instant day = now.minus(i, ChronoUnit.DAYS).truncatedTo(ChronoUnit.DAYS);
            String bucket = DAILY_FMT.format(day);
            result.put(bucket, readBucket(metric, bucket));
        }
        return result;
    }

    /**
     * Returns an ordered hour &rarr; count map for the last {@code hours} clock hours
     * (UTC), oldest first. Used for the hourly "new users" trend graph.
     */
    Map<String, Long> chartHours(String metric, int hours) {
        Map<String, Long> result = new LinkedHashMap<>();
        Instant now = Instant.now();
        for (int i = hours - 1; i >= 0; i--) {
            Instant hour = now.minus(i, ChronoUnit.HOURS).truncatedTo(ChronoUnit.HOURS);
            String bucket = HOURLY_FMT.format(hour);
            result.put(bucket, readBucket(metric, bucket));
        }
        return result;
    }

    private void incrementBucketKey(String key) {
        long current = readBucketByKey(key);
        store.put(key, String.valueOf(current + 1));
    }

    private long readBucket(String metric, String bucket) {
        return readBucketByKey(bucketKey(metric, bucket));
    }

    private long readBucketByKey(String key) {
        Object val = store.get(key);
        if (val == null) {
            return 0L;
        }
        try {
            return Long.parseLong(val.toString());
        } catch (NumberFormatException e) {
            LOGGER.warn("#####-CHATBOT-AUDIT unparseable counter '{}' at key {}", val, key);
            return 0L;
        }
    }

    private String bucketKey(String metric, String bucket) {
        return PREFIX + invokerId + "-" + metric + "-" + bucket;
    }
}
