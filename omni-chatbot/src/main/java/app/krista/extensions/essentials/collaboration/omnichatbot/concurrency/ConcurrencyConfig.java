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
import app.krista.extensions.essentials.collaboration.omnichatbot.utils.ChatBotUtil;
import app.krista.extensions.util.KeyValueStore;
import org.jvnet.hk2.annotations.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.inject.Inject;
import java.util.Map;

/**
 * Typed, fail-safe reader for the three admin-configurable concurrency settings
 * stored in the invoker's {@code uiConfigJson} map. All other tuning values are
 * compile-time constants in {@link ConcurrencyConstants}.
 *
 * <p>The {@code uiConfigJson} value is read straight from the distributed
 * {@link KeyValueStore} (the single source of truth that {@code ChatBotExtension}'s
 * in-memory cache mirrors). Reading the store directly — rather than through
 * {@code ChatBotExtension} — deliberately avoids a dependency cycle
 * ({@code ChatBotExtension -> ConcurrencyManager -> ConcurrencyConfig}). A
 * {@code /saveUIConfig} edit writes the store, so changes are picked up without a
 * restart.
 *
 * <p>Every accessor is defensive: a missing key, a non-numeric value, or an
 * unparseable config falls back to the documented default and never throws. In
 * particular {@link #isEnabled()} returns {@code false} on any read failure, so a
 * broken config means the feature is inert (today's behavior) — the fail-open
 * guarantee for the config layer.
 */
@Service
public class ConcurrencyConfig {

    private static final Logger LOGGER = LoggerFactory.getLogger(ConcurrencyConfig.class);

    private final KeyValueStore keyValueStore;

    @Inject
    public ConcurrencyConfig(KeyValueStore keyValueStore) {
        this.keyValueStore = keyValueStore;
    }

    /**
     * @return {@code true} only when the master kill switch is explicitly enabled
     *         and the config is readable; {@code false} otherwise (feature inert).
     */
    public boolean isEnabled() {
        try {
            return asBoolean(configMap().get(ConcurrencyConstants.KEY_ENABLED), false);
        } catch (Exception cause) {
            LOGGER.warn("#####-CHATBOT-CONCURRENCY config unreadable; treating feature as DISABLED: {}", cause.getMessage());
            return false;
        }
    }

    /**
     * @return the per-invoker active-user cap, clamped to a sane minimum.
     */
    public int maxConcurrentUsers() {
        int value = asInt(safeGet(ConcurrencyConstants.KEY_MAX_CONCURRENT_USERS), ConcurrencyConstants.DEFAULT_MAX_CONCURRENT_USERS);
        return Math.max(ConcurrencyConstants.MIN_MAX_CONCURRENT_USERS, value);
    }

    /**
     * @return total idle seconds before forced disconnect, clamped to a floor so
     *         the derived warning lead stays valid.
     */
    public int idleDisconnectSeconds() {
        int value = asInt(safeGet(ConcurrencyConstants.KEY_IDLE_DISCONNECT_SECONDS), ConcurrencyConstants.DEFAULT_IDLE_DISCONNECT_SECONDS);
        return Math.max(ConcurrencyConstants.MIN_IDLE_DISCONNECT_SECONDS, value);
    }

    /**
     * Derived (never admin-set): seconds before disconnect that the idle warning
     * modal appears. {@code min(cap, idleDisconnect / 2)} guarantees the warning
     * is always after session start and strictly before the disconnect.
     *
     * @return the idle-warning lead in seconds.
     */
    public int idleWarningLeadSeconds() {
        return Math.min(ConcurrencyConstants.IDLE_WARNING_LEAD_CAP_SECONDS, idleDisconnectSeconds() / 2);
    }

    private Object safeGet(String key) {
        try {
            return configMap().get(key);
        } catch (Exception cause) {
            LOGGER.warn("#####-CHATBOT-CONCURRENCY failed reading '{}'; using default: {}", key, cause.getMessage());
            return null;
        }
    }

    private Map<String, Object> configMap() {
        return ChatBotUtil.getConfigMap(readUiConfigJson());
    }

    private String readUiConfigJson() {
        Object stored = keyValueStore.get(Constants.UI_CONFIG_JSON);
        return stored != null ? stored.toString() : "{}";
    }

    private static boolean asBoolean(Object value, boolean fallback) {
        if (value instanceof Boolean bool) {
            return bool;
        }
        if (value instanceof String text) {
            return Boolean.parseBoolean(text.trim());
        }
        return fallback;
    }

    // Gson maps JSON numbers to Double; admins may also type the value as a String.
    private static int asInt(Object value, int fallback) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof String text && !text.isBlank()) {
            try {
                return (int) Double.parseDouble(text.trim());
            } catch (NumberFormatException ignored) {
                return fallback;
            }
        }
        return fallback;
    }
}
