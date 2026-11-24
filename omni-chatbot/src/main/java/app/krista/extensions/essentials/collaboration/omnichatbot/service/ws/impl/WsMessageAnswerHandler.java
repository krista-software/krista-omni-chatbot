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

import app.krista.extensions.essentials.collaboration.omnichatbot.audit.AuditService;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.ws.WsPayloadRequestHandler;
import app.krista.model.field.util.GsonJsonMapper;
import app.krista.omni.sdk.medium.api.MediumService;
import app.krista.omni.sdk.medium.api.dto.MessageAnswerDto;
import app.krista.omni.sdk.medium.api.message.MediumInfo;
import app.krista.omni.sdk.medium.interactive.InteractiveMessageIn;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;

/**
 * Handler for message answer (form response) payloads.
 *
 * <p>This handler processes form response submissions from the chatbot client
 * and forwards them to the medium service for processing.
 */
public class WsMessageAnswerHandler implements WsPayloadRequestHandler {

    private final MediumService mediumService;
    private final GsonJsonMapper gsonJsonMapper;
    private final AuditService auditService;
    private static final Logger LOGGER = LoggerFactory.getLogger(WsMessageAnswerHandler.class);

    public WsMessageAnswerHandler(MediumService mediumService, GsonJsonMapper gsonJsonMapper, AuditService auditService) {
        this.mediumService = mediumService;
        this.gsonJsonMapper = gsonJsonMapper;
        this.auditService = auditService;
    }

    /**
     * Handles incoming form response submissions.
     *
     * <p>Extracts the message answer from the payload, converts it to a MessageAnswerDto,
     * and forwards it to the medium service receiver for processing.
     *
     * @param payload the message payload containing the form response
     * @param mediumInfo the medium information identifying the chatbot and user
     */
    @Override
    public void handle(Map<String, Object> payload, MediumInfo mediumInfo) {
        Map<String, Object> messagePayload = (Map<String, Object>) payload.get("payload");
        String message = this.gsonJsonMapper.toString(messagePayload.get("message"));
        Object messageIn = this.gsonJsonMapper.fromString(message, MessageAnswerDto.class);
        LOGGER.warn("Received submit message: {}", message);
        this.mediumService.getReceiver().receiveMessage(new InteractiveMessageIn(mediumInfo, messageIn));
        auditService.recordFormSubmitted();
    }
}
