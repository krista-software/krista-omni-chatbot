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

import app.krista.extensions.essentials.collaboration.omnichatbot.contants.Constants;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ConcurrencyConfigTest {

    private ConcurrencyConfig configWith(String json) {
        InMemoryKeyValueStore kv = new InMemoryKeyValueStore();
        if (json != null) {
            kv.put(Constants.UI_CONFIG_JSON, json);
        }
        return new ConcurrencyConfig(kv);
    }

    @Test
    void disabledWithDefaultsWhenNoConfig() {
        ConcurrencyConfig config = configWith(null);
        assertThat(config.isEnabled()).isFalse();
        assertThat(config.maxConcurrentUsers()).isEqualTo(250);
        assertThat(config.idleDisconnectSeconds()).isEqualTo(300);
        assertThat(config.idleWarningLeadSeconds()).isEqualTo(120);
    }

    @Test
    void readsExplicitValues() {
        ConcurrencyConfig config = configWith(
                "{\"concurrencyControlEnabled\":true,\"maxConcurrentUsers\":50,\"idleDisconnectSeconds\":300}");
        assertThat(config.isEnabled()).isTrue();
        assertThat(config.maxConcurrentUsers()).isEqualTo(50);
        assertThat(config.idleDisconnectSeconds()).isEqualTo(300);
        // min(120, 300/2) = 120
        assertThat(config.idleWarningLeadSeconds()).isEqualTo(120);
    }

    @Test
    void clampsBelowMinimums() {
        ConcurrencyConfig config = configWith(
                "{\"concurrencyControlEnabled\":true,\"maxConcurrentUsers\":0,\"idleDisconnectSeconds\":5}");
        assertThat(config.maxConcurrentUsers()).isEqualTo(1);
        assertThat(config.idleDisconnectSeconds()).isEqualTo(30);
        // min(120, 30/2) = 15
        assertThat(config.idleWarningLeadSeconds()).isEqualTo(15);
    }

    @Test
    void coercesStringValues() {
        ConcurrencyConfig config = configWith(
                "{\"concurrencyControlEnabled\":\"true\",\"maxConcurrentUsers\":\"7\"}");
        assertThat(config.isEnabled()).isTrue();
        assertThat(config.maxConcurrentUsers()).isEqualTo(7);
    }

    @Test
    void failsSafeOnUnparseableConfig() {
        ConcurrencyConfig config = configWith("{not valid json");
        assertThat(config.isEnabled()).isFalse();
        assertThat(config.maxConcurrentUsers()).isEqualTo(250);
    }
}
