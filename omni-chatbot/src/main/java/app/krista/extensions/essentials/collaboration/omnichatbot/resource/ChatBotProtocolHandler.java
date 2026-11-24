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

package app.krista.extensions.essentials.collaboration.omnichatbot.resource;

import app.krista.extension.impl.anno.ApiRequest;
import app.krista.extension.request.ProtoRequest;
import app.krista.extension.request.ProtoResponse;
import app.krista.extension.request.protos.ws.WsEvent;
import app.krista.extension.request.protos.ws.WsProtocol;
import app.krista.extension.request.protos.ws.WsTextMessageReceived;
import app.krista.extensions.essentials.collaboration.omnichatbot.metrics.ChatBotMetrics;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.ws.WsEventHandlerRegistry;
import app.krista.ksdk.context.AuthorizationContext;
import app.krista.omni.sdk.spi.util.GsonJsonMapperImpl;
import com.google.gson.JsonObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.inject.Inject;
import java.io.IOException;

public class ChatBotProtocolHandler {

    private final AuthorizationContext authorizationContext;
    private final WsEventHandlerRegistry wsEventHandlerRegistry;
    private static final Logger LOGGER = LoggerFactory.getLogger(ChatBotProtocolHandler.class);

    @Inject
    public ChatBotProtocolHandler(AuthorizationContext authorizationContext, WsEventHandlerRegistry wsEventHandlerRegistry) {
        this.authorizationContext = authorizationContext;
        this.wsEventHandlerRegistry = wsEventHandlerRegistry;
    }


    /**
     * Handles incoming WebSocket events for the chatbot.
     *
     * <p>This method is the entry point for all WebSocket protocol events including:
     * <ul>
     *   <li>Connection upgrade requests</li>
     *   <li>Connection opened events</li>
     *   <li>Text message received events</li>
     *   <li>Connection closed events</li>
     *   <li>Ping/pong events</li>
     * </ul>
     *
     * <p>The appropriate handler is selected from the WsEventHandlerRegistry
     * based on the event type and invoked with the current authorization context.
     *
     * @param request the WebSocket protocol request (cast to WsEvent)
     * @return always returns {@code null} as WebSocket events are handled asynchronously
     * @throws IOException if an I/O error occurs during event handling
     */
    @ApiRequest(pathElement = "ws", protocol = WsProtocol.PROTOCOL_NAME)
    public ProtoResponse handleWebSocketEvent(ProtoRequest request) throws IOException {
        WsEvent wsEvent = (WsEvent) request;
        LOGGER.warn("WsEvent received frame type: {} Event connection Id: {}   ", wsEvent.getClass().getSimpleName(), wsEvent.getConnection().getConnectionId());
        // Telemetry only — classify the raw frame at the OUTERMOST WS entry (this runs for every
        // frame regardless of downstream handler dispatch or per-node auth timing) and count a real
        // inbound message HERE, so it can never be lost to an early-return further down the chain.
        // Fully wrapped so a telemetry/parse fault can never affect message processing. No functional change.
        recordFrameTelemetry(wsEvent);
        wsEventHandlerRegistry.getWsEventHandler(wsEvent).handle(authorizationContext, wsEvent);
        return null;
    }

    /**
     * Telemetry only. Emits one span per raw WS frame (tagged with frame class, signal, and payload
     * type) and, for a genuine inbound user message ({@code Message} / {@code MessageAnswer}),
     * counts it once at this outermost boundary. Pings and connection/welcome frames are excluded.
     * All parsing is best-effort and swallowed — this must never break the message flow.
     */
    private void recordFrameTelemetry(WsEvent wsEvent) {
        String frameType = wsEvent.getClass().getSimpleName();
        String signal = null;
        String payloadType = null;
        try {
            if (wsEvent instanceof WsTextMessageReceived textFrame) {
                textFrame.buffer();
                JsonObject json = GsonJsonMapperImpl.getInstance().fromString(textFrame.getString(), JsonObject.class);
                if (json != null) {
                    if (json.has("signal") && !json.get("signal").isJsonNull()) {
                        signal = json.get("signal").getAsString();
                    }
                    if (json.has("payload") && json.get("payload").isJsonObject()) {
                        JsonObject payload = json.getAsJsonObject("payload");
                        if (payload.has("type") && !payload.get("type").isJsonNull()) {
                            payloadType = payload.get("type").getAsString();
                        }
                    }
                }
            }
        } catch (Exception ignore) {
            // best-effort telemetry parse; never affect message flow
        }
        ChatBotMetrics.recordWsFrame(frameType, signal, payloadType);
        if ("Message".equals(payloadType) || "MessageAnswer".equals(payloadType)) {
            String accountId = null;
            try {
                if (authorizationContext.isAuthenticated() && authorizationContext.getAuthorizedAccount() != null) {
                    accountId = authorizationContext.getAuthorizedAccount().getAccountId();
                }
            } catch (Exception ignore) {
                // best-effort
            }
            ChatBotMetrics.recordMessageReceived(payloadType, accountId);
        }
    }


}
