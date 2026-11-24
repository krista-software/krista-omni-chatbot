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

/**
 * sessionId → AuthenticationResponse cache used by login / logout / upsertPersonAttributes.
 * Renamed from guest-auth's "AccountManager" to avoid clash with the KSDK Account Manager.
 */
public interface AuthAccountManager {

    void put(String sessionId, AuthenticationResponse authenticationResponse);

    AuthenticationResponse get(String sessionId);

    void delete(String sessionId);

}
