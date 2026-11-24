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

import app.krista.extension.request.protos.ws.*;
import app.krista.extension.util.InvokerAttributeProvider;
import app.krista.extensions.essentials.collaboration.omnichatbot.audit.AuditService;
import app.krista.extensions.essentials.collaboration.omnichatbot.concurrency.ConcurrencyManager;
import app.krista.extensions.essentials.collaboration.omnichatbot.contants.Constants;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.ws.impl.*;
import app.krista.extensions.essentials.collaboration.omnichatbot.store.ConnectionStore;
import app.krista.extensions.essentials.collaboration.omnichatbot.store.SessionStore;
import app.krista.extensions.util.KeyValueStore;
import app.krista.model.field.util.GsonJsonMapper;
import app.krista.omni.sdk.medium.interactive.InteractiveMediumService;
import app.krista.omni.sdk.spi.util.GsonJsonMapperImpl;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import org.jvnet.hk2.annotations.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.inject.Inject;
import javax.inject.Named;

/**
 * Registry for WebSocket event handlers.
 *
 * <p>This service provides the appropriate handler for each type of WebSocket event.
 * It maintains handlers for connection upgrade, opened, closed, text message, and ping events.
 */
@Service
public class WsEventHandlerRegistry {

    private static final Logger LOGGER = LoggerFactory.getLogger(WsEventHandlerRegistry.class);

    private final WsEventHandler connectionUpgradeRequestHandler;
    private final WsEventHandler connectionOpenedHandler;
    private final WsEventHandler requestHandler;
    private final WsEventHandler connectionClosedHandler;
    private final WsEventHandler connectionPingHandler;
    private final GsonJsonMapper gsonJsonMapper;

    @Inject
    private WsEventHandlerRegistry(WsPayloadHandlerRegistry payloadHandlerRegistry, ConnectionStore connectionStore,
            SessionStore sessionStore, ConcurrencyManager concurrencyManager, KeyValueStore keyValueStore,
            AuditService auditService,
            @Named(Constants.WELCOME_CONVERSATION_NAME) InvokerAttributeProvider<String> welcomeConversationProvider) {
        InteractiveMediumService mediumService = InteractiveMediumService.getInstance();
        this.connectionUpgradeRequestHandler = new WsConnectionUpgradeRequestHandler();
        this.connectionOpenedHandler = new WsConnectionOpenedHandler(connectionStore, mediumService,
                welcomeConversationProvider, sessionStore, concurrencyManager, keyValueStore, auditService);
        this.requestHandler = new WsRequestHandler(payloadHandlerRegistry, connectionStore);
        this.connectionClosedHandler = new WsConnectionClosedHandler(connectionStore, sessionStore, concurrencyManager, auditService);
        this.connectionPingHandler = new WsConnectionPingHandler(concurrencyManager, connectionStore, auditService);
        this.gsonJsonMapper = GsonJsonMapperImpl.getInstance();
    }

    /**
     * Returns the appropriate WebSocket event handler for the given event type.
     *
     * <p>Handler selection is based on the event type:
     * <ul>
     *   <li>{@code WsConnectionUpgradeRequest} - connection upgrade handler</li>
     *   <li>{@code WsConnectionOpened} - connection opened handler</li>
     *   <li>{@code WsConnectionClosed} - connection closed handler</li>
     *   <li>{@code WsTextMessageReceived} - request handler (or ping handler if signal is "ping")</li>
     *   <li>{@code WsPingReceived} - ping handler</li>
     * </ul>
     *
     * @param wsEvent the WebSocket event to get a handler for
     * @return the appropriate WsEventHandler for the event type
     * @throws IllegalStateException if the event type is not recognized
     */
    public WsEventHandler getWsEventHandler(WsEvent wsEvent) {
        if (wsEvent instanceof WsConnectionUpgradeRequest) {
            return connectionUpgradeRequestHandler;
        } else if (wsEvent instanceof WsConnectionOpened) {
            return connectionOpenedHandler;
        } else if (wsEvent instanceof WsConnectionClosed) {
            return connectionClosedHandler;
        } else if (wsEvent instanceof WsTextMessageReceived) {
            try {
                ((WsTextMessageReceived) wsEvent).buffer();
                WsTextMessageReceived textMessageReceived = (WsTextMessageReceived) wsEvent;
                String messageString = textMessageReceived.getString();
                JsonObject jsonObject = gsonJsonMapper.fromString(messageString, JsonObject.class);
                JsonElement signal = jsonObject.get("signal");
                if ("ping".equals(signal.getAsString())) {
                    return connectionPingHandler;
                }
            } catch (Exception e) {
                LOGGER.error("Error in WsEventHandlerRegistry.getWsEventHandler: {}", e.getMessage(), e);
            }
            return requestHandler;
        } else if (wsEvent instanceof WsPingReceived) {
            return connectionPingHandler;
        }
        throw new IllegalStateException("Unsupported WebSocket event type received. The chatbot only supports connection, text message, and ping events.");
    }
}
