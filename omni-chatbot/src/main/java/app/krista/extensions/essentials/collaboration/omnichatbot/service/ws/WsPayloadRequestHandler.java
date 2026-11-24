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

package app.krista.extensions.essentials.collaboration.omnichatbot.service.ws;

import app.krista.omni.sdk.medium.api.message.MediumInfo;

import java.util.Map;

/**
 * Interface for handling WebSocket message payloads.
 *
 * <p>Implementations process specific types of message payloads such as
 * welcome messages, user messages, and form response submissions.
 */
public interface WsPayloadRequestHandler {

    /**
     * Handles a WebSocket message payload.
     *
     * @param payload the message payload containing the data to process
     * @param mediumInfo the medium information identifying the chatbot and user
     */
    void handle(Map<String, Object> payload, MediumInfo mediumInfo);
}
