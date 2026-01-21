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

package app.krista.extensions.essentials.collaboration.omnichatbot.store;

import app.krista.extensions.util.KeyValueStore;
import org.jvnet.hk2.annotations.Service;

import javax.inject.Inject;
import java.util.Set;

/**
 * Persistent store for WebSocket connection IDs indexed by account ID.
 *
 * <p>This service provides a distributed key-value store for connection IDs,
 * backed by the platform's KeyValueStore. Unlike WsConnectionStore which is
 * local to each node, this store is shared across all nodes.
 */
@Service
public class ConnectionStore {

    private final KeyValueStore store;

    @Inject
    public ConnectionStore(KeyValueStore keyValueStore) {
        this.store = keyValueStore;
    }

    /**
     * Stores a connection ID for the specified account.
     *
     * @param accountId the account ID to associate with the connection
     * @param connectionId the WebSocket connection ID to store
     */
    public void put(String accountId, String connectionId) {
        store.put(accountId, connectionId);
    }

    /**
     * Retrieves the connection ID for the specified account.
     *
     * @param accountId the account ID to look up
     * @return the connection ID as a string, or "null" if not found
     */
    public String get(String accountId) {
        return String.valueOf(store.get(accountId));
    }

    /**
     * Removes the connection ID for the specified account.
     *
     * @param accountId the account ID whose connection should be removed
     */
    public void delete(String accountId) {
        store.remove(accountId);
    }

    /**
     * Removes all connection IDs from the store.
     *
     * <p>This method is typically called during invoker removal to clean up
     * all stored connections.
     */
    public void deleteAll() {
        Set<String> keys = store.getKeys();
        keys.forEach(store::remove);
    }
}
