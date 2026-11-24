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

import app.krista.extensions.util.KeyValueStore;
import org.jvnet.hk2.annotations.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.inject.Inject;

/**
 * Throughput-based estimator for queue wait time.
 *
 * <p>Maintains an exponential moving average (EMA) of completed, engaged session
 * durations in the shared store (so the estimate is consistent across nodes), and
 * derives the wait from queue position using Little's Law:
 * <pre>
 *   admissionRatePerSec = maxConcurrentUsers / avgSessionSeconds
 *   estimatedWaitSeconds = ceil(position / admissionRatePerSec)
 *                        = ceil(position * avgSessionSeconds / maxConcurrentUsers)
 * </pre>
 * Until enough real samples exist it falls back to the seed constant. Idle-timeout
 * disconnections are deliberately NOT recorded (the caller skips them) so the
 * average reflects genuinely engaged sessions rather than the idle ceiling.
 *
 * <p>The EMA read-modify-write is not atomic across nodes; a lost update only
 * perturbs an estimate, never correctness, so this is acceptable.
 */
@Service
public class WaitTimeEstimator {

    private static final Logger LOGGER = LoggerFactory.getLogger(WaitTimeEstimator.class);
    private static final char ENCODE_SEP = '|';
    private static final double EMA_ALPHA = 0.2d;
    // Ignore implausible durations so a clock glitch can't poison the average.
    private static final long MIN_SAMPLE_MS = 1000L;
    private static final long MAX_SAMPLE_MS = 6L * 60 * 60 * 1000;

    private final KeyValueStore store;

    @Inject
    public WaitTimeEstimator(KeyValueStore keyValueStore) {
        this.store = keyValueStore;
    }

    /** Records one completed, engaged session's duration into the rolling average. */
    public void recordSessionDuration(long durationMillis) {
        if (durationMillis < MIN_SAMPLE_MS || durationMillis > MAX_SAMPLE_MS) {
            return;
        }
        try {
            Sample current = read();
            double sampleSeconds = durationMillis / 1000.0d;
            double newAvg = current.count() == 0
                    ? sampleSeconds
                    : (EMA_ALPHA * sampleSeconds) + ((1 - EMA_ALPHA) * current.avgSeconds());
            store.put(ConcurrencyConstants.SESSION_SAMPLE_KEY, encode(newAvg, current.count() + 1));
        } catch (Exception cause) {
            LOGGER.warn("#####-CHATBOT-CONCURRENCY failed recording session duration: {}", cause.getMessage());
        }
    }

    /** Current rolling average session length in seconds (seed until enough samples). */
    public double avgSessionSeconds() {
        Sample sample = read();
        return sample.count() == 0 ? ConcurrencyConstants.AVG_SESSION_DURATION_SECONDS_SEED : sample.avgSeconds();
    }

    /**
     * Estimated wait for the given 1-based queue position.
     *
     * @return estimated wait in milliseconds (never negative).
     */
    public long estimateWaitMillis(int position, int maxConcurrentUsers) {
        if (position <= 0) {
            return 0L;
        }
        int capacity = Math.max(1, maxConcurrentUsers);
        double avgSeconds = Math.max(1.0d, avgSessionSeconds());
        long waitSeconds = (long) Math.ceil((position * avgSeconds) / capacity);
        return Math.max(0L, waitSeconds * 1000L);
    }

    private Sample read() {
        try {
            Object raw = store.get(ConcurrencyConstants.SESSION_SAMPLE_KEY);
            if (raw == null) {
                return new Sample(0, ConcurrencyConstants.AVG_SESSION_DURATION_SECONDS_SEED);
            }
            String text = raw.toString();
            int sep = text.indexOf(ENCODE_SEP);
            if (sep < 0) {
                return new Sample(0, ConcurrencyConstants.AVG_SESSION_DURATION_SECONDS_SEED);
            }
            double avg = Double.parseDouble(text.substring(0, sep));
            long count = Long.parseLong(text.substring(sep + 1));
            return new Sample(count, avg);
        } catch (Exception cause) {
            return new Sample(0, ConcurrencyConstants.AVG_SESSION_DURATION_SECONDS_SEED);
        }
    }

    private static String encode(double avgSeconds, long count) {
        return avgSeconds + String.valueOf(ENCODE_SEP) + count;
    }

    private record Sample(long count, double avgSeconds) {
    }
}
