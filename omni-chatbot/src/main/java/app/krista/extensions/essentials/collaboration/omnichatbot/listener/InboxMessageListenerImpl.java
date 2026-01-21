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

package app.krista.extensions.essentials.collaboration.omnichatbot.listener;

import app.krista.ksdk.inboxes.Inbox;
import app.krista.ksdk.inboxes.InboxMessageListener;
import app.krista.ksdk.message.Message;
import app.krista.omni.sdk.medium.api.KristaMessageReceiver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.text.MessageFormat;
import java.util.UUID;

/**
 * Implementation of InboxMessageListener for the chatbot extension.
 *
 * <p>This listener receives messages from the inbox and forwards them
 * to the KristaMessageReceiver for processing.
 */
public class InboxMessageListenerImpl implements InboxMessageListener {
    private static final UUID traceId = UUID.nameUUIDFromBytes(InboxMessageListenerImpl.class.getName().getBytes());
    private final KristaMessageReceiver kristaMessageReceiver;
    private static final Logger LOGGER = LoggerFactory.getLogger(InboxMessageListenerImpl.class);

    public InboxMessageListenerImpl() {
        this.kristaMessageReceiver = KristaMessageReceiver.getInstance();
    }

    /**
     * Handles incoming messages from the inbox.
     *
     * <p>Logs the message details and forwards the message to the
     * KristaMessageReceiver for further processing.
     *
     * @param inbox the inbox that received the message
     * @param message the received message
     */
    @Override
    public void messageReceived(Inbox inbox, Message message) {
        String logMessage = MessageFormat.format("messageID: {0}, listener inboxId: {1}, Message Type: {2}",
                message.getMessageId(), inbox.getInboxId(), message.getClass());
        LOGGER.info("#####-CHATBOT-MESSAGE RECEIVED - TRACE ID: {}, CLASS: {}, METHOD: {}, MESSAGE: {}, ACL: {}",
                        traceId, this.getClass().getName(), Thread.currentThread().getStackTrace()[1].getMethodName(),
                        logMessage, message.getAcl());
        kristaMessageReceiver.messageReceived(message);
    }
}
