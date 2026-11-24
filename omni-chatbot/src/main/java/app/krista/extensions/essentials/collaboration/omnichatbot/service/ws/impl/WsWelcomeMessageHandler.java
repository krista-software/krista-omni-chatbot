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

package app.krista.extensions.essentials.collaboration.omnichatbot.service.ws.impl;

import app.krista.extensions.essentials.collaboration.omnichatbot.service.ws.WsPayloadRequestHandler;
import app.krista.omni.sdk.medium.api.message.MediumInfo;

import java.util.Map;

/**
 * Handler for the legacy {@code "welcome"} WS payload.
 *
 * <p><b>Deliberate no-op.</b> The welcome conversation is now triggered
 * server-side in {@code WsConnectionOpenedHandler.triggerWelcomeConversation},
 * gated to fire exactly once per session via {@code SessionDto.welcomeExecuted}.
 * Any client still sending the legacy {@code "welcome"} payload — e.g. a tab
 * cached from before commit {@code daa00472c7} which dropped the frontend's
 * welcome handshake — is silently ignored here so the welcome conversation
 * cannot be re-fired on a WS reconnect by a stale client.
 *
 * <p>The class and its registration in {@code WsPayloadHandlerRegistry} are
 * kept on purpose: the payload dispatcher needs a handler for the
 * {@code "welcome"} type so that an unexpected payload doesn't cause a
 * dispatch error. The handler simply does nothing.
 */
public class WsWelcomeMessageHandler implements WsPayloadRequestHandler {

    public WsWelcomeMessageHandler() {
    }

    @Override
    public void handle(Map<String, Object> payload, MediumInfo mediumInfo) {
        // Deliberate no-op: welcome execution is owned by the WS-open auto-trigger
        // in WsConnectionOpenedHandler. See class javadoc for rationale.
    }
}
