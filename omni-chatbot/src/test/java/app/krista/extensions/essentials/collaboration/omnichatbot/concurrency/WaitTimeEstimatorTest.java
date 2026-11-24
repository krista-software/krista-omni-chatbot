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

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class WaitTimeEstimatorTest {

    private WaitTimeEstimator estimator;

    @BeforeEach
    void setUp() {
        estimator = new WaitTimeEstimator(new InMemoryKeyValueStore());
    }

    @Test
    void usesSeedUntilSamplesExist() {
        assertThat(estimator.avgSessionSeconds())
                .isEqualTo(ConcurrencyConstants.AVG_SESSION_DURATION_SECONDS_SEED);
    }

    @Test
    void zeroPositionIsZeroWait() {
        assertThat(estimator.estimateWaitMillis(0, 100)).isZero();
    }

    @Test
    void estimateFollowsLittlesLawWithSeed() {
        // ceil(position * avg / capacity) seconds. 50 * 180 / 100 = 90s.
        long waitMs = estimator.estimateWaitMillis(50, 100);
        assertThat(waitMs).isEqualTo(90_000L);
    }

    @Test
    void firstSampleSetsAverageThenEstimateShrinks() {
        estimator.recordSessionDuration(60_000L); // 60s session
        assertThat(estimator.avgSessionSeconds()).isEqualTo(60.0d);
        // 10 * 60 / 100 = 6s
        assertThat(estimator.estimateWaitMillis(10, 100)).isEqualTo(6_000L);
    }

    @Test
    void implausibleDurationsAreIgnored() {
        estimator.recordSessionDuration(10L);              // too short
        estimator.recordSessionDuration(7L * 60 * 60 * 1000); // too long
        assertThat(estimator.avgSessionSeconds())
                .isEqualTo(ConcurrencyConstants.AVG_SESSION_DURATION_SECONDS_SEED);
    }

    @Test
    void capacityIsClampedToAtLeastOne() {
        // Should not divide by zero / go negative.
        assertThat(estimator.estimateWaitMillis(3, 0)).isGreaterThan(0L);
    }
}
