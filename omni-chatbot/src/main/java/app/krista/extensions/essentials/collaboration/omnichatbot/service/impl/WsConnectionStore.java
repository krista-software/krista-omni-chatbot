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

package app.krista.extensions.essentials.collaboration.omnichatbot.service.impl;

import app.krista.extension.request.protos.ws.WsConnection;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;
import java.util.Objects;
import java.util.AbstractMap;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory store for WebSocket connections indexed by account ID.
 *
 * <p>This class provides a thread-safe cache for WebSocket connections using
 * a ConcurrentHashMap with an initial capacity of 128. It enables quick lookup
 * of connections by account ID or connection ID for message delivery.
 *
 * <p>Two indices are kept in sync: {@link #connectionStore} maps
 * {@code accountId → (connectionId, WsConnection)} for the primary write/read
 * path, and {@link #connectionIdToAccountId} is a reverse index used by
 * {@link #getAccountIdByWsConnectionId(String)} so that lookups by
 * connectionId are O(1) instead of an O(N) scan of the primary map. The
 * reverse index materially affects WS-upgrade latency under load — the
 * authenticator calls it on every upgrade, and on a fresh connection the
 * primary-map scan never matched but still walked every entry.
 *
 * <p>Note: This store is local to each node. In a multi-node deployment,
 * each node maintains its own connection store.
 */
public class WsConnectionStore {
    private static final Map<String, AbstractMap.SimpleEntry<String, WsConnection>> connectionStore = new ConcurrentHashMap<>(128);
    private static final Map<String, String> connectionIdToAccountId = new ConcurrentHashMap<>(128);
    // Connection-open timestamps (epoch millis) keyed by accountId, used by telemetry
    // to compute connection lifetime for the chatbot.session.duration metric.
    private static final Map<String, Long> connectionTimestamps = new ConcurrentHashMap<>(128);

    private static final Logger LOGGER = LoggerFactory.getLogger(WsConnectionStore.class);

    /**
     * Saves a WebSocket connection authorization for the specified account.
     *
     * <p>Associates the WebSocket connection with the account ID in the local
     * connection store. This enables message delivery to the correct WebSocket
     * connection when messages need to be sent to a specific account.
     *
     * @param wsConnection the WebSocket connection to store
     * @param accountId the account ID to associate with the connection
     * @throws IllegalStateException if the account ID is null
     */
    public static void saveConnectionAuthorization(WsConnection wsConnection, String accountId) {
        if (Objects.isNull(accountId)) {
            throw new IllegalStateException("WebSocket connection failed: No authenticated account found for connection '" + wsConnection.getConnectionId() + "'. Ensure the user is authenticated before establishing a WebSocket connection.");
        }
        AbstractMap.SimpleEntry<String, WsConnection> previous = connectionStore.put(
                accountId, new AbstractMap.SimpleEntry<>(wsConnection.getConnectionId(), wsConnection));
        if (previous != null && !Objects.equals(previous.getKey(), wsConnection.getConnectionId())) {
            connectionIdToAccountId.remove(previous.getKey());
        }
        connectionIdToAccountId.put(wsConnection.getConnectionId(), accountId);
        connectionTimestamps.put(accountId, System.currentTimeMillis());
    }

    /**
     * Retrieves the account ID associated with a WebSocket connection ID.
     *
     * <p>O(1) lookup via the {@link #connectionIdToAccountId} reverse index.
     * The previous implementation streamed {@link #connectionStore} to find
     * a matching connectionId, which scaled poorly under load — every WS
     * upgrade calls this method, and on a fresh connectionId the scan
     * iterated every entry without ever matching.
     *
     * @param connectionId the WebSocket connection ID to look up
     * @return the account ID associated with the connection, or {@code null} if not found
     */
    public static String getAccountIdByWsConnectionId(String connectionId) {
        return connectionIdToAccountId.get(connectionId);
    }

    /**
     * Retrieves the WebSocket connection for the specified account ID.
     *
     * @param accountId the account ID to look up
     * @return the WebSocket connection for the account, or {@code null} if not found
     * @throws IllegalStateException if the account ID is null
     */
    public static WsConnection getWsConnectionByAccountId(String accountId) {
        LOGGER.warn("Checking and returning websocket connection for the accountId: {}", accountId);
        if (!Objects.isNull(accountId)) {
            AbstractMap.SimpleEntry<String, WsConnection> wsConnectionEntry = connectionStore.get(accountId);
            if (!Objects.isNull(wsConnectionEntry)) {
                return wsConnectionEntry.getValue();
            }
            LOGGER.warn("There is no web-socket connection for the accountId: {} returning null", accountId);
            return null;
        }
        throw new IllegalStateException("Cannot retrieve WebSocket connection: Account ID is required but was not provided.");
    }

    /**
     * Removes the WebSocket connection for the specified account ID from the store.
     *
     * <p>This method should be called when a WebSocket connection is closed
     * to clean up the connection store.
     *
     * @param accountId the account ID whose connection should be removed
     * @throws IllegalStateException if the account ID is null
     */
    public static void deleteConnection(String accountId) {
        if (Objects.isNull(accountId)) {
            throw new IllegalStateException("Cannot remove WebSocket connection: Account ID is required but was not provided.");
        }
        LOGGER.warn("Removing connection from the local cache for the accountId: {}", accountId);
        AbstractMap.SimpleEntry<String, WsConnection> removed = connectionStore.remove(accountId);
        if (removed != null) {
            connectionIdToAccountId.remove(removed.getKey());
        }
        connectionTimestamps.remove(accountId);
    }

    /**
     * Returns the number of active WebSocket connections on this node.
     *
     * @return the count of active connections
     */
    public static int getActiveConnectionCount() {
        return connectionStore.size();
    }

    /**
     * Returns the connection duration in seconds for the specified account.
     *
     * <p>Calculates the elapsed time since the connection was established.
     * Returns -1 if no timestamp is recorded for the account.
     *
     * @param accountId the account ID to look up
     * @return the duration in seconds, or -1 if not found
     */
    public static double getConnectionDurationSeconds(String accountId) {
        Long connectTime = connectionTimestamps.get(accountId);
        if (connectTime == null) {
            return -1;
        }
        return (System.currentTimeMillis() - connectTime) / 1000.0;
    }
}
