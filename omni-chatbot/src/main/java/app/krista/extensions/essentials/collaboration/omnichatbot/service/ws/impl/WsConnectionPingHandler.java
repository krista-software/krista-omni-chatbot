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

import app.krista.extension.request.protos.ws.WsEvent;
import app.krista.extension.request.protos.ws.WsTextMessageReceived;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.impl.WsConnectionStore;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.ws.WsEventHandler;
import app.krista.ksdk.context.AuthorizationContext;
import app.krista.model.field.util.GsonJsonMapper;
import app.krista.omni.sdk.spi.util.GsonJsonMapperImpl;
import com.google.gson.JsonObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;

/**
 * Handler for WebSocket ping events.
 *
 * <p>This handler responds to ping messages from clients with a pong response,
 * enabling connection keep-alive functionality.
 */
public class WsConnectionPingHandler implements WsEventHandler {
    private final GsonJsonMapper gsonJsonMapper;
    private static final Logger LOGGER = LoggerFactory.getLogger(WsConnectionPingHandler.class);

    public WsConnectionPingHandler() {
        this.gsonJsonMapper = GsonJsonMapperImpl.getInstance();
    }

    /**
     * Handles ping messages by responding with a pong.
     *
     * <p>Modifies the incoming ping message to change the signal to "pong"
     * and adds a timestamp to the payload before sending the response.
     *
     * @param authorizationContext the authorization context containing user credentials
     * @param wsEvent the WebSocket ping event
     * @throws IOException if the pong response cannot be sent
     */
    @Override
    public void handle(AuthorizationContext authorizationContext, WsEvent wsEvent) throws IOException {
        if (authorizationContext.isAuthenticated()) {
            LOGGER.warn("Received ping request for accountId: {} over the connectionId: {}", authorizationContext.getAuthorizedAccount().getAccountId(), wsEvent.getConnection().getConnectionId());
        } else {
            LOGGER.warn("Received ping request for unauthenticated connectionId: {}", wsEvent.getConnection().getConnectionId());
        }

        try {
            String messageString = ((WsTextMessageReceived) wsEvent).getString();
            JsonObject jsonObject = gsonJsonMapper.fromString(messageString, JsonObject.class);
            jsonObject.addProperty("signal","pong");
            JsonObject payload = jsonObject.get("payload").getAsJsonObject();
            payload.addProperty("timestamp", System.currentTimeMillis());
            wsEvent.getResponseWriter().writeResponse(jsonObject.toString());
        } catch (Exception e) {
            LOGGER.error("#####-CHATBOT- ERROR HANDLING PING REQUEST: ", e);
        }
    }

    /**
     * Authenticates the WebSocket connection by looking up the account ID.
     *
     * @param accountId the account ID (not used, lookup is by connection ID)
     * @param wsEvent the WebSocket event containing the connection
     * @return the account ID associated with the connection, or {@code null} if not found
     * @throws IOException if authentication lookup fails
     */
    @Override
    public String authenticate(String accountId, WsEvent wsEvent) throws IOException {
        return WsConnectionStore.getAccountIdByWsConnectionId(wsEvent.getConnection().getConnectionId());
    }
}
