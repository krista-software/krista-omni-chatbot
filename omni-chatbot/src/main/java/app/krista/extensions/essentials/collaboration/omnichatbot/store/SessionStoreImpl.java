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

import app.krista.extensions.essentials.collaboration.omnichatbot.resource.dto.SessionDto;
import app.krista.extensions.util.KeyValueStore;
import app.krista.model.field.util.GsonJsonMapper;
import org.jvnet.hk2.annotations.ContractsProvided;
import org.jvnet.hk2.annotations.Service;

import javax.inject.Inject;
import java.util.Set;

/**
 * Implementation of SessionStore using the platform's KeyValueStore.
 *
 * <p>Sessions are stored as JSON strings with keys prefixed by "chatbot-session-".
 */
@Service
@ContractsProvided(value = SessionStore.class)
public class SessionStoreImpl implements SessionStore {

    private final KeyValueStore keyValueStore;
    private final GsonJsonMapper gsonJsonMapper;

    @Inject
    public SessionStoreImpl(KeyValueStore keyValueStore) {
        this.keyValueStore = keyValueStore;
        this.gsonJsonMapper = GsonJsonMapper.getInstance();
    }

    /**
     * {@inheritDoc}
     *
     * <p>Serializes the session to JSON and stores it with a prefixed key.
     */
    @Override
    public void put(String accountId, SessionDto sessionDto) {
        String session = gsonJsonMapper.toString(sessionDto);
        keyValueStore.put(toKey(accountId), session);
    }

    /**
     * Generates the storage key for an account ID.
     *
     * @param accountId the account ID
     * @return the prefixed storage key
     */
    private String toKey(String accountId) {
        return "chatbot-session-" + accountId;
    }

    /**
     * {@inheritDoc}
     *
     * <p>Retrieves and deserializes the session from JSON.
     */
    @Override
    public SessionDto get(String accountId) {
        String sessionString = (String) keyValueStore.get(toKey(accountId));
        return gsonJsonMapper.fromString(sessionString, SessionDto.class);
    }

    /**
     * {@inheritDoc}
     *
     * <p>Removes all keys from the underlying KeyValueStore.
     */
    @Override
    public void deleteAll() {
        Set<String> keys = keyValueStore.getKeys();
        keys.forEach(keyValueStore::remove);
    }
}
