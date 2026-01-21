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
import app.krista.extensions.essentials.collaboration.omnichatbot.resource.dto.NotificationMessage;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.impl.WsConnectionStore;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.ws.WsEventHandler;
import app.krista.extensions.essentials.collaboration.omnichatbot.store.ConnectionStore;
import app.krista.ksdk.context.AuthorizationContext;
import app.krista.ksdk.notifications.Notification;
import app.krista.model.field.util.GsonJsonMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.Map;
import java.util.Objects;

/**
 * Handler for WebSocket connection opened events.
 *
 * <p>This handler is invoked when a WebSocket connection is successfully established.
 * It validates the user's authorization, stores the connection, and sends a
 * ConnectionEstablished notification to the client.
 */
public class WsConnectionOpenedHandler implements WsEventHandler {

    private final GsonJsonMapper gsonJsonMapper = GsonJsonMapper.getInstance();
    private static final Logger LOGGER = LoggerFactory.getLogger(WsConnectionOpenedHandler.class);
    private final ConnectionStore connectionStore;

    public WsConnectionOpenedHandler(ConnectionStore connectionStore) {
        this.connectionStore = connectionStore;
    }

    /**
     * Handles the WebSocket connection opened event.
     *
     * <p>If the user is authenticated:
     * <ul>
     *   <li>Enables auto-pong for the connection</li>
     *   <li>Stores the connection in WsConnectionStore</li>
     *   <li>Stores the connection ID in ConnectionStore</li>
     *   <li>Sends a ConnectionEstablished notification to the client</li>
     * </ul>
     *
     * <p>If the user is not authenticated, closes the connection with code 1008.
     *
     * @param authorizationContext the authorization context containing user credentials
     * @param wsEvent the WebSocket connection opened event
     * @throws IOException if sending the notification fails
     */
    @Override
    public void handle(AuthorizationContext authorizationContext, WsEvent wsEvent) throws IOException {
        if (authorizationContext.isAuthenticated()) {
            String accountId = authorizationContext.getAuthorizedAccount().getAccountId();
            String connectionId = wsEvent.getConnection().getConnectionId();
            LOGGER.warn("User is authorized with accountId: {} and connectionId: {}", accountId, connectionId);
            wsEvent.getConnection().setAutoPong(true);
            WsConnectionStore.saveConnectionAuthorization(wsEvent.getConnection(), accountId);
            LOGGER.warn("Successfully saved the upgraded Web socket connection for the accountId: {} and connectionId: {}", accountId, connectionId);
            this.connectionStore.put(accountId, connectionId);
            Notification notification = new Notification("ConnectionEstablished", System.currentTimeMillis(), Map.of());
            wsEvent.getConnection().sendTextMessage(gsonJsonMapper.toString(new NotificationMessage("notification", notification)));
        } else {
            LOGGER.warn("#####-CHATBOT- USER IS NOT AUTHENTICATED, CAN NOT OPEN, CLOSING CONNECTION: {}", wsEvent.getConnection().getConnectionId());
            wsEvent.getConnection().close(1008, "User is not Authorised, can not open");
        }
    }

    /**
     * Authenticates a WebSocket connection by account ID.
     *
     * <p>If the connection is not already associated with an account and a valid
     * account ID is provided, saves the connection authorization.
     *
     * @param accountId the account ID to authenticate
     * @param wsEvent the WebSocket event containing the connection
     * @return the authenticated account ID, or the existing account ID if already authenticated
     */
    @Override
    public String authenticate(String accountId, WsEvent wsEvent) {
        String accountIdByWsConnectionId = WsConnectionStore.getAccountIdByWsConnectionId(wsEvent.getConnection().getConnectionId());
        if (Objects.isNull(accountIdByWsConnectionId) && !Objects.isNull(accountId)) {
            LOGGER.warn("Authorization successful for accountId: {} and connectionId: {}", accountId, wsEvent.getConnection().getConnectionId());
            WsConnectionStore.saveConnectionAuthorization(wsEvent.getConnection(), accountId);
            return accountId;
        }
        return accountIdByWsConnectionId;
    }

}
