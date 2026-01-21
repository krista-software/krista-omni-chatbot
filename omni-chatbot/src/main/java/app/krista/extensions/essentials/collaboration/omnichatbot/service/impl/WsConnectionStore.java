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

import java.net.InetAddress;
import java.net.UnknownHostException;
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
 * <p>Note: This store is local to each node. In a multi-node deployment,
 * each node maintains its own connection store.
 */
public class WsConnectionStore {
    private static final Map<String, AbstractMap.SimpleEntry<String, WsConnection>> connectionStore = new ConcurrentHashMap<>(128);

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
        LOGGER.warn("#####-CHATBOT-Adding connection details into the Local connection store map for accountId: {} and connectionId: {}", accountId, wsConnection.getConnectionId());
        String hostname = null;
        try {
            hostname = InetAddress.getLocalHost().getHostName();
        } catch (UnknownHostException e) {
            LOGGER.error("#####-CHATBOT-Failed to resolve hostname");
        }
        LOGGER.warn("#####-CHATBOT-saveConnectionAuthorization | processId: {} and serverId: {}", ProcessHandle.current().pid(), hostname);
        connectionStore.put(accountId, new AbstractMap.SimpleEntry<>(wsConnection.getConnectionId(), wsConnection));
        LOGGER.warn("#####-CHATBOT-saveConnectionAuthorization | Connection store size: {}", connectionStore.size());
    }

    /**
     * Retrieves the account ID associated with a WebSocket connection ID.
     *
     * <p>Searches through all stored connections to find the account ID
     * that owns the specified connection ID.
     *
     * @param connectionId the WebSocket connection ID to look up
     * @return the account ID associated with the connection, or {@code null} if not found
     */
    public static String getAccountIdByWsConnectionId(String connectionId) {
        return connectionStore.entrySet().stream()
                .filter(entry -> Objects.equals(connectionId, entry.getValue().getKey()))
                .map(Map.Entry::getKey).findFirst().orElse(null);
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
        LOGGER.warn("Connection store size: {}", connectionStore.size());
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
        connectionStore.remove(accountId);
    }
}
