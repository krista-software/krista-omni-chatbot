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
import app.krista.model.field.util.GsonJsonMapper;
import app.krista.omni.sdk.medium.api.MediumService;
import app.krista.omni.sdk.medium.api.dto.MessageDto;
import app.krista.omni.sdk.medium.api.message.MediumInfo;
import app.krista.omni.sdk.medium.interactive.InteractiveMessageIn;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;

/**
 * Handler for user text message payloads.
 *
 * <p>This handler processes incoming text messages from the chatbot client
 * and forwards them to the medium service for processing.
 */
public class WsMessageHandler implements WsPayloadRequestHandler {
    private final MediumService mediumService;
    private final GsonJsonMapper gsonJsonMapper;
    private static final Logger LOGGER = LoggerFactory.getLogger(WsMessageHandler.class);

    public WsMessageHandler(MediumService mediumService, GsonJsonMapper gsonJsonMapper) {
        this.mediumService = mediumService;
        this.gsonJsonMapper = gsonJsonMapper;
    }

    /**
     * Handles incoming user text messages.
     *
     * <p>Extracts the message from the payload, converts it to a MessageDto,
     * and forwards it to the medium service receiver for processing.
     *
     * @param payload the message payload containing the user's message
     * @param mediumInfo the medium information identifying the chatbot and user
     */
    @Override
    @SuppressWarnings("unchecked")
    public void handle(Map<String, Object> payload, MediumInfo mediumInfo) {
        Map<String, Object> messagePayload = (Map<String, Object>) payload.get("payload");
        if (messagePayload == null) {
            LOGGER.error("#####-CHATBOT- MESSAGE PAYLOAD IS NULL FOR TARGET ADDRESS: {}", mediumInfo.getTargetAddress());
        }

        try {
            String message = this.gsonJsonMapper.toString(messagePayload.get("message"));
            LOGGER.warn("LOGGER.warn{}", message);
            Object messageIn = this.gsonJsonMapper.fromString(message, MessageDto.class);
            this.mediumService.getReceiver().receiveMessage(new InteractiveMessageIn(mediumInfo, messageIn));
        } catch (Exception e) {
            LOGGER.error("#####-CHATBOT- ERROR PROCESSING MESSAGE FOR TARGET ADDRESS: {}", mediumInfo.getTargetAddress(), e);
        }
    }
}
