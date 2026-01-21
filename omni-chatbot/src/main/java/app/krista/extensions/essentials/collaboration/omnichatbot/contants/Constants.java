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

package app.krista.extensions.essentials.collaboration.omnichatbot.contants;

import java.io.IOException;
import java.io.InputStream;
import java.util.Properties;

public class Constants {

    private Constants() {
        throw new IllegalStateException("Invalid access to utility class.");
    }

    public static final String WELCOME_CONVERSATION_NAME = "Welcome Conversation";
    public static final String UI_CONFIG_JSON = "uiConfigJson";
    public static final String FALLBACK_CONVERSATION = "Fallback Conversation";
    public static final String JAX_RS_ID = "chatbot";
    public static final String MEDIUM_TYPE = "CHATBOT";
    public static final String SOURCE = "source";
    public static final String COOKIE = "Cookie";
    public static final String CHATBOT_SESSION_ID = "Chatbot-Session-Id";
    public static final String CALLER_URI = "caller_uri";
    public static final String ENDPOINT_ENTITY = "/entities";

    // Launcher version - reads from multiple sources in priority order:
    // 1. Environment variable (runtime)
    // 2. launcher.properties file (build-time)
    // 3. Default "v1"
    // Only launcher-core filename changes, launcher.js is the entry point and stays constant
    public static final String LAUNCHER_VERSION = getLauncherVersion();
    public static final String LAUNCHER_CORE_FILENAME = "launcher-core-" + LAUNCHER_VERSION + ".js";

    private static String getLauncherVersion() {
        // Priority 1: Environment variable (runtime)
        String envVersion = System.getenv("LAUNCHER_VERSION");
        if (envVersion != null && !envVersion.isEmpty()) {
            return envVersion;
        }

        // Priority 2: Properties file (build-time)
        try (InputStream input = Constants.class.getClassLoader().getResourceAsStream("launcher.properties")) {
            if (input != null) {
                Properties prop = new Properties();
                prop.load(input);
                String propVersion = prop.getProperty("launcher.version");
                if (propVersion != null && !propVersion.isEmpty()) {
                    return propVersion;
                }
            }
        } catch (IOException e) {
            // Ignore and fall back to default
        }

        // Priority 3: Default
        return "v1";
    }
}
