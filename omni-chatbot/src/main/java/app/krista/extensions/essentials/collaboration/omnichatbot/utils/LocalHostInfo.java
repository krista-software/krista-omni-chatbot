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

import java.net.InetAddress;
import java.net.UnknownHostException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Resolves and caches the local host's name and address once at class load.
 *
 * <p>Replaces ad-hoc {@code InetAddress.getLocalHost().getHostName()} /
 * {@code .getHostAddress()} calls scattered across the chatbot. Those calls
 * are a well-known Java performance trap: each invocation goes through the
 * JDK's {@code getaddrinfo} → DNS reverse-lookup path, taking anywhere from
 * tens of milliseconds to several seconds depending on local DNS health
 * (Docker / Kubernetes / on-prem with misconfigured {@code /etc/hosts} are
 * common offenders). Under load — e.g. concurrent WS upgrades calling
 * {@code WsConnectionStore.saveConnectionAuthorization} — these calls can
 * also serialize at the JDK / OS layer, compounding tail latency.
 *
 * <p>Both values are stable for the lifetime of the JVM, so we resolve them
 * once at class initialization. Failure to resolve degrades to the string
 * {@code "unknown"} — every call site uses these values only for
 * logging or identification, so the degradation is harmless.
 */
public final class LocalHostInfo {

    private static final Logger LOGGER = LoggerFactory.getLogger(LocalHostInfo.class);

    private static final String HOST_NAME;
    private static final String HOST_ADDRESS;

    static {
        InetAddress localHost = resolveLocalHost();
        HOST_NAME = localHost != null ? localHost.getHostName() : "unknown";
        HOST_ADDRESS = localHost != null ? localHost.getHostAddress() : "unknown";
    }

    private static InetAddress resolveLocalHost() {
        try {
            return InetAddress.getLocalHost();
        } catch (UnknownHostException cause) {
            LOGGER.warn("#####-CHATBOT-Could not resolve local host at startup; callers will see 'unknown' for hostname and address", cause);
            return null;
        }
    }

    private LocalHostInfo() {
        // utility class — no instances
    }

    /**
     * @return the local host name (e.g. {@code "host-01"}), resolved once at
     *         class load. Returns {@code "unknown"} if resolution failed.
     */
    public static String hostName() {
        return HOST_NAME;
    }

    /**
     * @return the local host's primary IP address (e.g. {@code "10.0.0.5"}),
     *         resolved once at class load. Returns {@code "unknown"} if
     *         resolution failed.
     */
    public static String hostAddress() {
        return HOST_ADDRESS;
    }

}
