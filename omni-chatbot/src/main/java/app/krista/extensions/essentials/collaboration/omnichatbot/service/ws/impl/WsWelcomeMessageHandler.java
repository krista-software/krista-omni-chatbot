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

import app.krista.extension.util.InvokerAttributeProvider;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.ws.WsPayloadRequestHandler;
import app.krista.omni.sdk.medium.api.message.MediumInfo;
import app.krista.omni.sdk.medium.interactive.InteractiveMediumService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;

/**
 * Handler for welcome message payloads.
 *
 * <p>This handler is triggered when a client sends a "welcome" payload type.
 * It executes the configured welcome conversation for the user's inbox.
 */
public class WsWelcomeMessageHandler implements WsPayloadRequestHandler {
    private final InteractiveMediumService mediumService;
    private final InvokerAttributeProvider<String> welcomeConversationProvider;
    private static final Logger LOGGER = LoggerFactory.getLogger(WsWelcomeMessageHandler.class);

    public WsWelcomeMessageHandler(InteractiveMediumService mediumService, InvokerAttributeProvider<String> welcomeConversationProvider) {
        this.mediumService = mediumService;
        this.welcomeConversationProvider = welcomeConversationProvider;
    }

    /**
     * Handles the welcome message payload by executing the welcome conversation.
     *
     * <p>Extracts the inbox ID from the payload and triggers the configured
     * welcome conversation for that inbox.
     *
     * @param payload the message payload containing the inbox ID
     * @param mediumInfo the medium information for the chatbot
     */
    @SuppressWarnings("unchecked")
    @Override
    public void handle(Map<String, Object> payload, MediumInfo mediumInfo) {
        String conversationName = this.welcomeConversationProvider.get();
        LOGGER.warn("#####-CHATBOT-Received the welcome message executing welcome conversation: {}", conversationName);
        Map<String, Object> innerPayload = (Map<String, Object>) payload.get("payload");
        String inboxId = (String) innerPayload.get("inboxId");
        this.mediumService.executeConversation(inboxId, conversationName);
        LOGGER.warn("#####-CHATBOT-Welcome conversation Executed successfully for inboxId: {}", inboxId);
    }
}
