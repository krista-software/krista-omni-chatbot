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

import app.krista.extension.request.protos.ws.WsConnection;
import app.krista.extension.request.protos.ws.WsEvent;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.impl.WsConnectionStore;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.ws.WsEventHandler;
import app.krista.ksdk.context.AuthorizationContext;

import java.util.Objects;

/**
 * Handler for WebSocket connection upgrade requests.
 *
 * <p>This handler processes HTTP upgrade requests to establish WebSocket connections.
 * It accepts the upgrade request and stores the connection authorization.
 */
public class WsConnectionUpgradeRequestHandler implements WsEventHandler {

    /**
     * Handles the WebSocket connection upgrade request by accepting the connection.
     *
     * @param authorizationContext the authorization context (not used for upgrade)
     * @param wsEvent the WebSocket upgrade request event
     */
    @Override
    public void handle(AuthorizationContext authorizationContext, WsEvent wsEvent) {
        WsConnection wsConnection = wsEvent.getConnection();
        wsConnection.accept();
    }

    /**
     * Authenticates the WebSocket connection during upgrade.
     *
     * <p>If the connection is not already associated with an account,
     * saves the connection authorization with the provided account ID.
     *
     * @param accountId the account ID to authenticate
     * @param wsEvent the WebSocket event containing the connection
     * @return the authenticated account ID
     */
    @Override
    public String authenticate(String accountId, WsEvent wsEvent) {
        String accountIdByWsConnectionId = WsConnectionStore.getAccountIdByWsConnectionId(wsEvent.getConnection().getConnectionId());
        if (Objects.isNull(accountIdByWsConnectionId)) {
            WsConnectionStore.saveConnectionAuthorization(wsEvent.getConnection(), accountId);
            return accountId;
        }
        return accountIdByWsConnectionId;
    }

}
