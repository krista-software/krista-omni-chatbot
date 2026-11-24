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
import app.krista.extensions.essentials.collaboration.omnichatbot.audit.AuditService;
import app.krista.extensions.essentials.collaboration.omnichatbot.concurrency.ConcurrencyManager;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.ws.WsEventHandler;
import app.krista.extensions.essentials.collaboration.omnichatbot.store.ConnectionStore;
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
    private final ConcurrencyManager concurrencyManager;
    private static final Logger LOGGER = LoggerFactory.getLogger(WsConnectionPingHandler.class);

    private final ConnectionStore connectionStore;
    private final AuditService auditService;

    public WsConnectionPingHandler(ConcurrencyManager concurrencyManager, ConnectionStore connectionStore,
            AuditService auditService) {
        this.gsonJsonMapper = GsonJsonMapperImpl.getInstance();
        this.concurrencyManager = concurrencyManager;
        this.connectionStore = connectionStore;
        this.auditService = auditService;
    }

    /**
     * Handles ping messages by responding with a pong for authenticated
     * connections.
     *
     * <p>Modifies the incoming ping message to change the signal to "pong"
     * and adds a timestamp to the payload before sending the response.
     *
     * <p>Unauthenticated pings do NOT get a pong: no identity is resolvable for
     * the connection, locally or via the distributed reverse index (see
     * {@link WsAuthorizationRecovery}), so the account behind it no longer
     * exists — typically deleted after a session timeout whose notice the
     * client never received. Answering pong would keep that dead session
     * looking healthy forever. Instead the connection is closed with 1012
     * (service restart — deliberately NOT in the frontend's
     * STOP_RECONNECT_CODES) so the client auto-reconnects: a transient auth
     * glitch heals through the fresh handshake, while a truly deleted account
     * fails the open-authentication and receives a definitive 1008 close from
     * WsConnectionOpenedHandler — which triggers the frontend's session-timeout
     * fallback notice.
     *
     * @param authorizationContext the authorization context containing user credentials
     * @param wsEvent the WebSocket ping event
     * @throws IOException if the pong response cannot be sent
     */
    @Override
    public void handle(AuthorizationContext authorizationContext, WsEvent wsEvent) throws IOException {
        if (authorizationContext.isAuthenticated()) {
            String accountId = authorizationContext.getAuthorizedAccount().getAccountId();
            // Refresh the concurrency slot heartbeat so the reaper keeps this active
            // user's slot alive. No-op unless the feature flag is enabled.
            concurrencyManager.onWsPing(accountId);
            // Refresh the audit live-presence heartbeat so "active now" stays accurate
            // and self-heals: a dropped connection stops pinging and falls out of the count.
            auditService.recordPresence(accountId);
        } else {
            LOGGER.warn("Received ping request for unauthenticated connectionId: {}; closing so the client re-handshakes",
                    wsEvent.getConnection().getConnectionId());
            wsEvent.getConnection().close(1012, "Re-authentication required");
            return;
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
        return WsAuthorizationRecovery.resolveAccountId(connectionStore, wsEvent);
    }
}
