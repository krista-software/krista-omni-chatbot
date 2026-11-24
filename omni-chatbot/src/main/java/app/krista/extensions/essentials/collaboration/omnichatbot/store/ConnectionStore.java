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

/**
 * Persistent store for WebSocket connection IDs indexed by account ID.
 *
 * <p>This service provides a distributed key-value store for connection IDs,
 * backed by the platform's KeyValueStore. Unlike WsConnectionStore which is
 * local to each node, this store is shared across all nodes.
 *
 * <p>Keys are namespaced with {@link #KEY_PREFIX} because the same per-invoker
 * {@link KeyValueStore} is shared with other consumers — notably the SDK
 * {@code AccountStore}, which writes {@code store.put(accountId, "a_"+userIdentifier)}.
 * Keying connections by the raw {@code accountId} let that write clobber the
 * connection id under the same key, so a timeout/notification was published with
 * a bogus connection id (e.g. {@code a_wsContact_...}) and the platform dropped it
 * as "does not belong to this server". Mirrors the prefixing already used by
 * SessionStoreImpl ("chatbot-session-"), PoolStore, and ConcurrencyConstants.
 */
@Service
public class ConnectionStore {

    private static final String KEY_PREFIX = "chatbot-connection-";
    // Reverse index (connectionId -> accountId). Starts with KEY_PREFIX so
    // deleteAll()'s prefix filter covers both directions. Needed to recover a
    // connection's authorization after an invoker upgrade: the node-local
    // WsConnectionStore (static, per-classloader) is wiped by the reload, but
    // this distributed store survives — the WS event handlers fall back to it
    // to re-authenticate frames arriving on connections opened pre-upgrade.
    private static final String REVERSE_KEY_PREFIX = KEY_PREFIX + "rev-";

    private final KeyValueStore store;

    @Inject
    public ConnectionStore(KeyValueStore keyValueStore) {
        this.store = keyValueStore;
    }

    private String toKey(String accountId) {
        return KEY_PREFIX + accountId;
    }

    private String toReverseKey(String connectionId) {
        return REVERSE_KEY_PREFIX + connectionId;
    }

    /**
     * Stores a connection ID for the specified account, plus the reverse
     * (connectionId &rarr; accountId) entry. A previous connection of the same
     * account has its stale reverse entry removed so the reverse index never
     * resolves a dead connection.
     *
     * @param accountId the account ID to associate with the connection
     * @param connectionId the WebSocket connection ID to store
     */
    public void put(String accountId, String connectionId) {
        Object previous = store.get(toKey(accountId));
        if (previous != null && !previous.toString().equals(connectionId)) {
            store.remove(toReverseKey(previous.toString()));
        }
        store.put(toKey(accountId), connectionId);
        store.put(toReverseKey(connectionId), accountId);
    }

    /**
     * Retrieves the connection ID for the specified account.
     *
     * @param accountId the account ID to look up
     * @return the connection ID, or {@code null} if not found
     */
    public String get(String accountId) {
        Object value = store.get(toKey(accountId));
        return value == null ? null : value.toString();
    }

    /**
     * Retrieves the account ID that owns the specified connection ID via the
     * reverse index. Used to re-authenticate live WebSocket connections after
     * an invoker upgrade wiped the node-local {@code WsConnectionStore}.
     *
     * @param connectionId the WebSocket connection ID to look up
     * @return the account ID, or {@code null} if not found
     */
    public String getAccountIdByConnectionId(String connectionId) {
        Object value = store.get(toReverseKey(connectionId));
        return value == null ? null : value.toString();
    }

    /**
     * Removes the connection ID for the specified account, including the
     * reverse (connectionId &rarr; accountId) entry.
     *
     * @param accountId the account ID whose connection should be removed
     */
    public void delete(String accountId) {
        Object connectionId = store.get(toKey(accountId));
        if (connectionId != null) {
            store.remove(toReverseKey(connectionId.toString()));
        }
        store.remove(toKey(accountId));
    }

    /**
     * Removes all connection IDs from the store.
     *
     * <p>This method is typically called during invoker removal to clean up
     * all stored connections. Scoped to this store's own prefixed keys so it
     * does not wipe unrelated entries in the shared KeyValueStore.
     */
    public void deleteAll() {
        store.getKeys().stream()
                .filter(key -> key != null && key.startsWith(KEY_PREFIX))
                .forEach(store::remove);
    }
}
