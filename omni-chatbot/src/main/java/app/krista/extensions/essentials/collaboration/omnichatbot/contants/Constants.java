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
    // Label for the invoker's workspace-admin-rights ("Trust Extension") switch. Unlike the entries
    // above this is NOT an invoker attribute: it lives on the invoker configuration and is written
    // through the workspaceAdminRights argument of InvokerConfiguration.saveChanges.
    public static final String TRUST_EXTENSION = "Trust Extension";
    public static final String JAX_RS_ID = "chatbot";
    public static final String MEDIUM_TYPE = "CHATBOT";
    public static final String SOURCE = "source";
    public static final String COOKIE = "Cookie";
    public static final String CHATBOT_SESSION_ID = "Chatbot-Session-Id";
    public static final String CALLER_URI = "caller_uri";
    public static final String ENDPOINT_ENTITY = "/entities";

    // Single source of truth for the generic fallback shown when the Welcome Conversation
    // can't run and the admin hasn't configured a custom Fallback Message. Used by the
    // backend push (WsConnectionOpenedHandler) AND surfaced as the Integration Settings
    // input placeholder (substituted into integration/index.html) so the two never drift.
    public static final String DEFAULT_FALLBACK_MESSAGE =
            "Sorry, we're having trouble responding right now. Please try again in a little while.";

    // Single source of truth for the greeting shown on chat start when NO Welcome
    // Conversation is configured. The backend pushes it (WsConnectionOpenedHandler) —
    // using the admin's configured "welcomeMessage" when set, otherwise this default —
    // and it is also surfaced as the Integration Settings input placeholder (substituted
    // into integration/index.html) so the two never drift.
    public static final String DEFAULT_WELCOME_MESSAGE = "Hi! How can I help you today?";

    // Cache-Control header values (shared across ChatBotResource and ChatBotUIService)
    public static final String CACHE_NO_STORE = "no-cache, no-store, must-revalidate";
    // stale-if-error lets the CDN serve the last-good copy while the origin (Extension
    // Proxy) is unavailable — e.g. during an invoker upgrade — so cacheable endpoints
    // (config, supportedLanguages, launcher.js/css, index.html) survive the restart window.
    public static final String CACHE_PUBLIC_30MIN = "public, max-age=1800, s-maxage=1800, stale-if-error=86400";
    // CDN-only caching: s-maxage lets shared caches (CloudFront) hold the response for
    // 30 min, while max-age=0 makes the browser re-fetch on every page load — served by
    // the edge, not the origin. Used for launcher.js so a launcher change propagates
    // within the CDN TTL alone instead of the CDN + browser TTLs stacking.
    public static final String CACHE_CDN_ONLY_30MIN = "public, s-maxage=1800, max-age=0, stale-if-error=86400";
    public static final String CACHE_PUBLIC_1YEAR = "public, max-age=31536000, s-maxage=31536000, immutable";

    // Build-time cache mode. `gradle build-dev` bakes cache.disabled=true into the jar
    // (via cache-mode.properties), making every cacheable response resolve to no-store
    // (always fresh, CDN caching off). A normal `gradle build`/`jar` keeps the production
    // headers. The runtime env override CHATBOT_CACHE_DISABLED wins, mirroring
    // LAUNCHER_VERSION's env-then-properties-then-default resolution.
    public static final boolean CACHE_DISABLED = isCacheDisabled();

    private static boolean isCacheDisabled() {
        // Priority 1: Environment variable (runtime)
        String envDisabled = System.getenv("CHATBOT_CACHE_DISABLED");
        if (envDisabled != null && !envDisabled.isEmpty()) {
            return Boolean.parseBoolean(envDisabled);
        }

        // Priority 2: Properties file (build-time, written by the gradle build-dev task)
        try (InputStream input = Constants.class.getClassLoader().getResourceAsStream("cache-mode.properties")) {
            if (input != null) {
                Properties prop = new Properties();
                prop.load(input);
                return Boolean.parseBoolean(prop.getProperty("cache.disabled", "false"));
            }
        } catch (IOException e) {
            // Ignore and fall back to default
        }

        // Priority 3: Default (production caching enabled)
        return false;
    }

    // Central gate for every cacheable response: returns no-store when caching is
    // disabled (build-dev / env override), otherwise the given production value.
    public static String resolveCacheControl(String cacheControl) {
        return CACHE_DISABLED ? CACHE_NO_STORE : cacheControl;
    }

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
