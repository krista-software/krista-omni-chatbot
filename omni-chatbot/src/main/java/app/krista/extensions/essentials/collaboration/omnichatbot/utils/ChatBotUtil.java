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

package app.krista.extensions.essentials.collaboration.omnichatbot.utils;

import app.krista.extensions.essentials.collaboration.omnichatbot.ChatBotExtension;
import app.krista.model.field.util.GsonJsonMapper;

import java.util.Map;

/**
 * Utility class for common operations used in the ChatBot application.
 */
public final class ChatBotUtil {

    static final GsonJsonMapper GSON_JSON_MAPPER = GsonJsonMapper.create();

    private ChatBotUtil() {
    }

    /**
     * Checks if a given string is null, empty, or consists only of whitespace characters.
     *
     * @param name The string to check.
     * @return True if the string is null, empty, or consists only of whitespace characters.
     */
    public static boolean isNullOrEmpty(String name) {
        return name == null || name.isEmpty() || name.isBlank();
    }

    /**
     * Converts the provided UI config JSON string to a Map.
     *
     * @param uiConfigJson The JSON string representing UI configuration.
     * @return A Map<String, Object> representation of the UI configuration.
     * @throws IllegalArgumentException If the provided JSON is invalid.
     */
    @SuppressWarnings("unchecked")
    public static Map<String, Object> getConfigMap(String uiConfigJson) {
        try {
            return GSON_JSON_MAPPER.fromString(uiConfigJson, Map.class);
        } catch (Exception exception) {
            throw new IllegalArgumentException("Invalid ‘UI Config Json’ format. Please ensure the provided value is a valid Json.");
        }
    }

    /**
     * Gets the UI config JSON from the in-memory cache (mirrors the KeyValueStore,
     * the single source of truth populated on invoker load and on every save).
     *
     * @param chatBotExtension The ChatBotExtension instance that holds the cache
     * @return The UI config JSON string, or "{}" if not found
     */
    public static String getJsonConfig(ChatBotExtension chatBotExtension) {
        String result = chatBotExtension.getCachedUiConfig();
        return result != null ? result : "{}";
    }
}
