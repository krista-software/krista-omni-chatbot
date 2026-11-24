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

package app.krista.extensions.essentials.collaboration.omnichatbot.auth;

import java.util.concurrent.ConcurrentHashMap;
import app.krista.extensions.util.KeyValueStore;
import com.google.gson.Gson;
import org.jvnet.hk2.annotations.ContractsProvided;
import org.jvnet.hk2.annotations.Service;

import javax.inject.Inject;

/**
 * Session → {@link AuthenticationResponse} mapping, used on the WS-upgrade hot
 * path by {@link GuestRequestAuthenticator} to resolve the authenticated
 * account for each incoming request.
 *
 * <p>Backed by {@link KeyValueStore} for restart survival and visibility across
 * extension instances, fronted by an in-process {@link ConcurrentHashMap} to
 * avoid the KVS round-trip (and per-call Gson parse) on every request. Same
 * write-through shape as {@code ChatBotExtension.configCache} for UI config —
 * the cache is the source of truth for reads, KVS is the source of truth for
 * durability and cross-instance visibility.
 *
 * <p>Pool refill calls {@link #put(String, AuthenticationResponse)} for every
 * pre-warmed session, so by the time a user pops an entry and opens a WS the
 * server-side {@link GuestRequestAuthenticator#getAuthenticatedAccountId}
 * lookup resolves entirely from this cache — eliminating the KVS read that
 * was driving WS-upgrade tail latency under load.
 *
 * <p>Lazy-populate on read miss handles two cases that warrant a KVS fallback:
 * fresh-start (cache empty, sessions persisted by a prior process), and the
 * cross-instance case (a {@code put} from another extension instance not yet
 * reflected locally). Either way the missing entry is back-filled into the
 * cache so the next read is fast.
 *
 * <p>Cross-instance staleness: a {@code delete} on instance A leaves instance
 * B's cache temporarily holding the removed entry. This matches the existing
 * 5-min staleness window the pool sweep already tolerates — the sweep
 * validates each entry's session and account on every cycle and drops
 * invalidated ones (see {@code ChatBotPool.sweepInvalidEntries}).
 */
@Service
@ContractsProvided(AuthAccountManager.class)
public class AuthAccountManagerImpl implements AuthAccountManager {

    private final KeyValueStore keyValueStore;
    private final Gson gson;
    private final ConcurrentHashMap<String, AuthenticationResponse> cache = new ConcurrentHashMap<>();

    @Inject
    public AuthAccountManagerImpl(KeyValueStore keyValueStore) {
        this.keyValueStore = keyValueStore;
        this.gson = new Gson();
    }

    @Override
    public void put(String sessionId, AuthenticationResponse authenticationResponse) {
        cache.put(sessionId, authenticationResponse);
        keyValueStore.put(sessionId, gson.toJson(authenticationResponse));
    }

    @Override
    public AuthenticationResponse get(String sessionId) {
        AuthenticationResponse hit = cache.get(sessionId);
        if (hit != null) {
            return hit;
        }
        String authResponse = (String) keyValueStore.get(sessionId);
        if (authResponse == null) {
            return null;
        }
        AuthenticationResponse parsed = gson.fromJson(authResponse, AuthenticationResponse.class);
        if (parsed != null) {
            cache.put(sessionId, parsed);
        }
        return parsed;
    }

    @Override
    public void delete(String sessionId) {
        cache.remove(sessionId);
        keyValueStore.remove(sessionId);
    }

}
