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
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Persistent store for warm-pool login entries indexed by a generated key.
 *
 * <p>Backed by the platform's KeyValueStore. Each entry is serialized JSON; the
 * pool's namespace is isolated with a fixed key prefix so entries do not collide
 * with other KeyValueStore consumers (ConnectionStore, SessionStore, etc.).
 */
@Service
public class PoolStore {

    private static final String POOL_KEY_PREFIX = "chatbot-pool-login-";

    private final KeyValueStore store;

    @Inject
    public PoolStore(KeyValueStore keyValueStore) {
        this.store = keyValueStore;
    }

    public void put(String key, String value) {
        store.put(key, value);
    }

    public String get(String key) {
        Object value = store.get(key);
        return value == null ? null : value.toString();
    }

    public void delete(String key) {
        store.remove(key);
    }

    public void deleteAll() {
        getKeys().forEach(store::remove);
    }

    public Set<String> getKeys() {
        return store.getKeys().stream()
                .filter(k -> k != null && k.startsWith(POOL_KEY_PREFIX))
                .collect(Collectors.toSet());
    }

    public static String newKey() {
        return POOL_KEY_PREFIX + UUID.randomUUID();
    }

}
