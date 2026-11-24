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

package app.krista.extensions.essentials.collaboration.omnichatbot.resource.dto;

public class SessionDto {

    private final String sessionInboxId;
    // True once the configured welcome conversation has been auto-triggered
    // for this session at least once. Used to suppress re-triggering on WS
    // reconnects within the same session (network drops, page refreshes)
    // — the welcome conversation is a one-shot per session, not per WS
    // connection.
    private boolean welcomeExecuted;

    public SessionDto(String sessionInboxId) {
        this.sessionInboxId = sessionInboxId;
    }

    public String getSessionInboxId() {
        return sessionInboxId;
    }

    public boolean isWelcomeExecuted() {
        return welcomeExecuted;
    }

    public void setWelcomeExecuted(boolean welcomeExecuted) {
        this.welcomeExecuted = welcomeExecuted;
    }
}
