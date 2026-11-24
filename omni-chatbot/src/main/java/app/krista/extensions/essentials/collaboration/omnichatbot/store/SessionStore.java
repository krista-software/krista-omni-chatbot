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

/**
 * Interface for storing and retrieving chatbot session data.
 *
 * <p>Implementations provide persistent storage for session information
 * indexed by account ID.
 */
public interface SessionStore {

    /**
     * Stores a session for the specified account.
     *
     * @param accountId the account ID to associate with the session
     * @param sessionDto the session data to store
     */
    void put(String accountId, SessionDto sessionDto);

    /**
     * Retrieves the session for the specified account.
     *
     * @param accountId the account ID to look up
     * @return the SessionDto for the account, or {@code null} if not found
     */
    SessionDto get(String accountId);

    /**
     * Removes all sessions from the store.
     */
    void deleteAll();

}
