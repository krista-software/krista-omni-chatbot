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
import app.krista.extensions.essentials.collaboration.omnichatbot.audit.AuditService;
import app.krista.extensions.essentials.collaboration.omnichatbot.concurrency.ConcurrencyManager;
import app.krista.extensions.essentials.collaboration.omnichatbot.metrics.ChatBotMetrics;
import app.krista.extensions.essentials.collaboration.omnichatbot.resource.dto.SessionDto;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.impl.WsConnectionStore;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.ws.WsEventHandler;
import app.krista.extensions.essentials.collaboration.omnichatbot.store.ConnectionStore;
import app.krista.extensions.essentials.collaboration.omnichatbot.store.SessionStore;
import app.krista.ksdk.context.AuthorizationContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.Objects;

/**
 * Handler for WebSocket connection closed events.
 *
 * <p>This handler is invoked when a WebSocket connection is closed.
 * It cleans up the connection from both WsConnectionStore and ConnectionStore.
 */
public class WsConnectionClosedHandler implements WsEventHandler {

    private static final Logger LOGGER = LoggerFactory.getLogger(WsConnectionClosedHandler.class);
    private final ConnectionStore connectionStore;
    private final SessionStore sessionStore;
    private final ConcurrencyManager concurrencyManager;
    private final AuditService auditService;

    public WsConnectionClosedHandler(ConnectionStore connectionStore, SessionStore sessionStore,
            ConcurrencyManager concurrencyManager, AuditService auditService) {
        this.connectionStore = connectionStore;
        this.sessionStore = sessionStore;
        this.concurrencyManager = concurrencyManager;
        this.auditService = auditService;
    }

    /**
     * Handles the WebSocket connection closed event.
     *
     * <p>Performs cleanup by:
     * <ul>
     *   <li>Looking up the account ID associated with the closed connection</li>
     *   <li>Removing the connection from WsConnectionStore</li>
     *   <li>Removing the connection from ConnectionStore</li>
     *   <li>Closing the connection with code 1000 (normal closure)</li>
     * </ul>
     *
     * @param authorizationContext the authorization context (not used for close events)
     * @param wsEvent the WebSocket connection closed event
     * @throws IOException if closing the connection fails
     */
    @Override
    public void handle(AuthorizationContext authorizationContext, WsEvent wsEvent) throws IOException {
        WsConnection closedConnection = wsEvent.getConnection();
        String accountId = WsAuthorizationRecovery.resolveAccountId(connectionStore, wsEvent);
        LOGGER.warn("Closing websocket request received for accountId: {} so removing connection from the local map with connectionId: {}",
                accountId, closedConnection.getConnectionId());
        if (!Objects.isNull(accountId)) {
            // Telemetry only: read connection duration before deleteConnection() clears the timestamp.
            double durationSeconds = WsConnectionStore.getConnectionDurationSeconds(accountId);
            SessionDto sessionDto = sessionStore.get(accountId);
            if (sessionDto != null && sessionDto.getSessionInboxId() != null) {
                WelcomeExecutionTracker.onConnectionClosed(sessionDto.getSessionInboxId());
            }
            WsConnectionStore.deleteConnection(accountId);
            connectionStore.delete(accountId);
            // Release one ref from the concurrency slot. When the last tab closes
            // the slot enters a grace period (~45s) for reconnection. No-op unless
            // the feature flag is enabled.
            concurrencyManager.onWsClosed(accountId);
            ChatBotMetrics.recordConnectionClosed(accountId);
            ChatBotMetrics.recordSessionEnded("user_close");
            if (durationSeconds >= 0) {
                ChatBotMetrics.recordSessionDuration(durationSeconds);
            }
            auditService.recordWsDisconnected();
            // Drop the live-presence heartbeat immediately on a graceful close.
            auditService.removePresence(accountId);
        } else {
            LOGGER.warn("#####-CHATBOT- NO ACCOUNT ID FOUND FOR CONNECTION ID: {} DURING CONNECTION CLOSE", closedConnection.getConnectionId());
            // Telemetry only: still record the close so connection-close totals are not silently
            // dropped when the connectionId->accountId reverse index can't resolve. No functional change.
            ChatBotMetrics.recordConnectionClosed(null);
            ChatBotMetrics.recordSessionEnded("connection_lost");
        }
        closedConnection.close(1000, "The connection has closed after the request was fulfilled.");
    }

    /**
     * Authentication is not applicable for connection closed events.
     *
     * @param accountId the account ID (ignored)
     * @param wsEvent the WebSocket event (ignored)
     * @return always returns {@code null}
     */
    @Override
    public String authenticate(String accountId, WsEvent wsEvent) {
        return null;
    }
}
