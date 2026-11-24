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
import app.krista.extensions.essentials.collaboration.omnichatbot.metrics.ChatBotMetrics;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.ws.WsEventHandler;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.ws.WsPayloadRequestHandler;
import app.krista.extensions.essentials.collaboration.omnichatbot.store.ConnectionStore;
import app.krista.ksdk.accounts.Account;
import app.krista.ksdk.context.AuthorizationContext;
import app.krista.ksdk.notifications.Notification;
import app.krista.model.field.util.GsonJsonMapper;
import app.krista.omni.sdk.medium.api.message.MediumInfo;
import app.krista.omni.sdk.spi.util.GsonJsonMapperImpl;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.Map;

/**
 * Handler for WebSocket text message received events.
 *
 * <p>This handler processes incoming text messages from WebSocket clients,
 * parses them as notifications, and delegates to the appropriate payload handler
 * based on the message type.
 */
public class WsRequestHandler implements WsEventHandler {
    private final WsPayloadHandlerRegistry payloadHandlerRegistry;
    private final GsonJsonMapper gsonJsonMapper;
    private static final String CHATBOT_MEDIUM_TYPE = "CHATBOT";
    private static final Logger LOGGER = LoggerFactory.getLogger(WsRequestHandler.class);//NOSONAR

    private final ConnectionStore connectionStore;

    public WsRequestHandler(WsPayloadHandlerRegistry payloadHandlerRegistry, ConnectionStore connectionStore) {
        this.payloadHandlerRegistry = payloadHandlerRegistry;
        this.connectionStore = connectionStore;
        this.gsonJsonMapper = GsonJsonMapperImpl.getInstance();
    }

    /**
     * Handles incoming WebSocket text messages.
     *
     * <p>Parses the message as a Notification, extracts the payload type,
     * and delegates to the appropriate payload handler. Only processes
     * messages from authenticated users.
     *
     * @param authorizationContext the authorization context containing user credentials
     * @param wsEvent the WebSocket text message received event
     * @throws IOException if message processing fails
     */
    @Override
    @SuppressWarnings("unchecked")
    public void handle(AuthorizationContext authorizationContext, WsEvent wsEvent) throws IOException {
        try {
            String messageString = ((WsTextMessageReceived) wsEvent).getString();
            Notification notification = gsonJsonMapper.fromString(messageString, Notification.class);
            // NOTE: inbound message-received telemetry is emitted once at the outermost WS entry
            // (ChatBotProtocolHandler), which runs for every frame regardless of the account guard
            // below — so no message-count is needed here (it would double-count).
            Account authorizedAccount = authorizationContext.getAuthorizedAccount();
            if (authorizedAccount == null) {
                LOGGER.error("#####-CHATBOT- NO AUTHORIZED ACCOUNT FOUND FOR CONNECTION ID: {}", wsEvent.getConnection().getConnectionId());
                return;
            }
            LOGGER.warn("Received the message for the accountId: {} and connectionId: {}", authorizedAccount.getAccountId(), wsEvent.getConnection().getConnectionId());
            MediumInfo mediumInfo = new MediumInfo(CHATBOT_MEDIUM_TYPE, authorizedAccount.getAccountId());
            Map<String, Object> payload = notification.getPayload();
            if (payload == null) {
                LOGGER.error("#####-CHATBOT- NOTIFICATION PAYLOAD IS NULL FOR ACCOUNT ID: {}", authorizedAccount.getAccountId());
                return;
            }
            WsPayloadRequestHandler wsPayloadRequestHandler = payloadHandlerRegistry.getHandler((String) payload.get("type"));
            LOGGER.warn("Received the message payload of type: {} for accountId: {} and connectionId: {}", payload.get("type"), authorizedAccount.getAccountId(), wsEvent.getConnection().getConnectionId());
            if (wsPayloadRequestHandler != null) {
                wsPayloadRequestHandler.handle(payload, mediumInfo);
            } else {
                LOGGER.warn("#####-CHATBOT- NO HANDLER FOUND FOR PAYLOAD TYPE: {} FOR ACCOUNT ID: {}", payload.get("type"), authorizedAccount.getAccountId());
            }
        } catch (Exception e) {
            LOGGER.error("#####-CHATBOT- ERROR PROCESSING WEBSOCKET MESSAGE FOR CONNECTION ID: {}", wsEvent.getConnection().getConnectionId(), e);
            ChatBotMetrics.recordError("WsRequestHandler", e);
        }
    }

    /**
     * Authenticates a WebSocket connection by looking up the account ID.
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
