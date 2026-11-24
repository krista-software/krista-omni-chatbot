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

package app.krista.extensions.essentials.collaboration.omnichatbot.service;

import app.krista.extension.executor.Invoker;
import app.krista.extension.request.protos.ws.WsConnection;
import app.krista.extensions.essentials.collaboration.omnichatbot.audit.AuditService;
import app.krista.extensions.essentials.collaboration.omnichatbot.metrics.ChatBotMetrics;
import app.krista.extensions.essentials.collaboration.omnichatbot.resource.dto.NotificationMessage;
import app.krista.extensions.essentials.collaboration.omnichatbot.resource.dto.SessionDto;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.impl.WsConnectionStore;
import app.krista.extensions.essentials.collaboration.omnichatbot.store.ConnectionStore;
import app.krista.extensions.essentials.collaboration.omnichatbot.store.SessionStore;
import app.krista.extensions.essentials.collaboration.omnichatbot.utils.ActiveMQConsumer;
import app.krista.extensions.essentials.collaboration.omnichatbot.utils.ActiveMQProducer;
import app.krista.extensions.essentials.collaboration.omnichatbot.utils.LocalHostInfo;
import app.krista.ksdk.message.MessageAnswer;
import app.krista.ksdk.notifications.Notification;
import app.krista.ksdk.storage.StorageProvider;
import app.krista.model.field.util.GsonJsonMapper;
import app.krista.omni.sdk.medium.api.dto.MessageDto;
import app.krista.omni.sdk.medium.interactive.InteractiveMessageOut;
import app.krista.omni.sdk.medium.interactive.message.InteractiveMediumMessageSender;
import app.krista.omni.sdk.spi.util.GsonJsonMapperImpl;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.jvnet.hk2.annotations.Service;
import org.slf4j.LoggerFactory;

import javax.inject.Inject;
import javax.jms.*;
import java.io.IOException;
import java.util.*;

@Service
public class ChatBotMessageSender implements InteractiveMediumMessageSender {
    private static final org.slf4j.Logger LOGGER = LoggerFactory.getLogger(ChatBotMessageSender.class);

    private final SessionStore sessionStore;
    private final GsonJsonMapper gsonJsonMapper;
    private final ConnectionStore connectionStore;
    private final ActiveMQProducer producer;
    private final ActiveMQConsumer stateConsumer;
    private final AuditService auditService;

    @Inject
    public ChatBotMessageSender(SessionStore sessionStore, StorageProvider storageProvider,
                                Invoker invoker, ConnectionStore connectionStore,
                                AuditService auditService) throws JMSException, IOException {
        this.sessionStore = sessionStore;
        this.connectionStore = connectionStore;
        this.gsonJsonMapper = GsonJsonMapperImpl.getInstance();
        this.producer = ActiveMQProducer.create(storageProvider, invoker);
        this.stateConsumer = ActiveMQConsumer.create(storageProvider, invoker);
        this.auditService = auditService;
        initStateConsumer();
    }

    /**
     * Initializes the ActiveMQ state consumer with a message listener.
     *
     * <p>The listener processes incoming state messages from the ActiveMQ topic
     * and forwards execution state updates to the appropriate WebSocket connections.
     *
     * @throws JMSException if the message listener cannot be set
     */
    private void initStateConsumer() throws JMSException {
        stateConsumer.setMessageListener(message -> {
            if (!(message instanceof TextMessage textMessage)) return;
            try {
                String json = textMessage.getText();
                JsonObject payloadObj = getJsonObject(json);
                if (payloadObj == null) return;

                String accountId = payloadObj.get("accountId").getAsString();
                Map<String, Object> payload = createPayload(payloadObj, accountId);

                sendExecutionStateUpdateNotification(accountId, payload);

            } catch (Exception e) {
                LOGGER.error("#####-CHATBOT-Error processing chatbot state message", e);
                ChatBotMetrics.recordError("ChatBotMessageSender", e);
            }
        });
    }

    /**
     * Sends an execution state update notification to a specific account's WebSocket connection.
     *
     * <p>Looks up the WebSocket connection for the given account ID and sends the
     * execution state update notification if a connection exists on this node.
     *
     * @param accountId the account ID to send the notification to
     * @param payload the notification payload containing execution state information
     */
    private void sendExecutionStateUpdateNotification(String accountId, Map<String, Object> payload) {
        var wsConnection = WsConnectionStore.getWsConnectionByAccountId(accountId);
        if (wsConnection == null) {
            return;
        }
        NotificationMessage executionStateUpdateNotification = createExecutionStateUpdateNotification(payload);
        try {
            wsConnection.sendTextMessage(gsonJsonMapper.toString(executionStateUpdateNotification));
            ChatBotMetrics.recordNotificationSent("ExecutionStateUpdateNotification");
        } catch (IOException e) {
            LOGGER.error("#####-CHATBOT-Failed to send WS message to accountId={}", accountId, e);
            ChatBotMetrics.recordError("ChatBotMessageSender", e);
        }
    }

    /**
     * Creates a payload map from a JSON object for state notifications.
     *
     * @param payloadObj the JSON object containing the payload data
     * @param accountId the account ID to include in the payload
     * @return a map containing accountId, executionId, and state
     */
    private Map<String, Object> createPayload(JsonObject payloadObj, String accountId) {
        String executionId = payloadObj.has("executionId") ? payloadObj.get("executionId").getAsString() : null;
        String status = payloadObj.has("status") ? payloadObj.get("status").getAsString() : null;
        Map<String, Object> payload = new HashMap<>();
        payload.put("accountId", accountId);
        payload.put("executionId", executionId);
        payload.put("state", status);
        return payload;
    }

    /**
     * Extracts the payload JSON object from a message JSON string.
     *
     * <p>Handles nested payload structures where the payload may be wrapped
     * in another payload object. Returns null if the payload is missing,
     * empty, or lacks an accountId.
     *
     * @param json the JSON string to parse
     * @return the extracted payload JsonObject, or {@code null} if invalid
     */
    private JsonObject getJsonObject(String json) {
        JsonObject root = JsonParser.parseString(json).getAsJsonObject();

        JsonObject payloadObj = null;
        if (root.has("payload") && root.get("payload").isJsonObject()) {
            payloadObj = root.getAsJsonObject("payload");
            if (payloadObj.has("payload") && payloadObj.get("payload").isJsonObject()) {
                payloadObj = payloadObj.getAsJsonObject("payload");
            }
        }

        // If payload is missing or empty -> do nothing
        if (payloadObj == null || payloadObj.entrySet().isEmpty()) {
            LOGGER.debug("#####-CHATBOT-Received state message with no payload — ignoring.");
            return null;
        }

        if (!payloadObj.has("accountId")) {
            LOGGER.debug("#####-CHATBOT-Payload has no accountId — ignoring state message.");
            return null;
        }
        return payloadObj;
    }


    /**
     * Sends messages to WebSocket clients via ActiveMQ for distributed delivery.
     *
     * <p>For each outgoing message, this method:
     * <ul>
     *   <li>Retrieves the WebSocket connection for the target account</li>
     *   <li>Builds a notification payload with inbox ID, connection ID, and messages</li>
     *   <li>Publishes the notification to ActiveMQ for delivery to all nodes</li>
     *   <li>Skips sidebar-answered messages</li>
     * </ul>
     *
     * @param list the list of interactive messages to send
     */
    @Override
    public void sendMessages(List<InteractiveMessageOut> list) {
        // Telemetry only, at the OUTERMOST level: count every outbound message the bot
        // produced (including welcome-conversation messages) here, before the per-message
        // delivery guards below early-return — otherwise specific cases (cold connection,
        // sidebar-answered, etc.) are silently uncounted. No functional change.
        if (list != null) {
            list.forEach(m -> ChatBotMetrics.recordMessageSent(m.getMediumInfo().getTargetAddress()));
        }
        int dispatched = 0;
        for (InteractiveMessageOut outMessage : list) {
            String targetAddress = outMessage.getMediumInfo().getTargetAddress();
            // Deliver via the DISTRIBUTED connection id + the shared ActiveMQ topic, NOT the
            // node-local WsConnectionStore. WsConnectionStore is an in-memory static map that
            // only holds sockets authenticated on this node's current classloader, so a
            // background sender (the SDK session-timeout monitor) — or this code after an
            // extension reload — sees null for a perfectly live socket and silently drops the
            // message while the user is still deleted. The platform's NettyWsRequestHandler
            // routes by connectionId to whichever node owns the socket.
            SessionDto sessionDto = sessionStore.get(targetAddress);
            if (sessionDto == null) {
                LOGGER.error("#####-CHATBOT- NO SESSION FOUND FOR ACCOUNT ID: {}", targetAddress);
                continue;
            }
            String connectionId = connectionStore.get(targetAddress);
            if (connectionId == null) {
                LOGGER.error("#####-CHATBOT- NO CONNECTION ID FOUND FOR ACCOUNT ID: {}", targetAddress);
                continue;
            }
            MessageDto messageDto = outMessage.getMessage();
            if (isSidebarAnsweredMessage(messageDto)) {
                continue;
            }
            Map<String, Object> payload = new HashMap<>();
            payload.put("inboxId", sessionDto.getSessionInboxId());
            payload.put("connectionId", connectionId);
            payload.put("messages", List.of(messageDto));
            sendNotificationPayload(payload, targetAddress, messageDto.getType());
            dispatched++;
        }
        if (dispatched > 0) {
            auditService.recordBotMessages(dispatched);
        }
    }

    /**
     * Sends a notification payload to ActiveMQ for distributed WebSocket delivery.
     *
     * <p>Creates and sends a NewMessages notification, and optionally an UpdateMessage
     * notification if the message type is ANSWERED.
     *
     * @param payload the notification payload to send
     * @param targetAddress the target account ID
     * @param messageType the type of message being sent
     */
    private void sendNotificationPayload(Map<String, Object> payload, String targetAddress, String messageType) {
        Notification updateNotification = null;
        if (Objects.equals(MessageDto.TYPE_ANSWERED, messageType)) {
            updateNotification = createNotification(payload, "UpdateMessage");
        }
        NotificationMessage notificationMessage = createNewMessageNotification(payload);
        String newOutMessage = gsonJsonMapper.toString(notificationMessage);
        try {
            producer.sendMessage(newOutMessage);
            ChatBotMetrics.recordActiveMqMessageSent();
            ChatBotMetrics.recordNotificationSent("NewMessages");
            if (!Objects.isNull(updateNotification)) {
                String updateOutMessage = gsonJsonMapper.toString(new NotificationMessage("notification", updateNotification));
                producer.sendMessage(updateOutMessage);
                ChatBotMetrics.recordActiveMqMessageSent();
                ChatBotMetrics.recordNotificationSent("UpdateMessage");
            }
        } catch (Exception cause) {
            LOGGER.error("#####-CHATBOT- ERROR WHILE SENDING MESSAGE FOR ACCOUNTID: {} FROM HOST: {}", targetAddress, LocalHostInfo.hostAddress(), cause);
            ChatBotMetrics.recordError("ChatBotMessageSender", cause);
        }
    }


    /**
     * Creates a notification object with the specified type and payload.
     *
     * @param payload the notification payload
     * @param type the notification type (e.g., "NewMessages", "UpdateMessage")
     * @return a new Notification object
     */
    private Notification createNotification(Map<String, Object> payload, String type) {
        return new Notification(type, System.currentTimeMillis(), payload);
    }

    /**
     * Creates a NewMessages notification message.
     *
     * @param payload the notification payload
     * @return a NotificationMessage wrapping a NewMessages notification
     */
    private NotificationMessage createNewMessageNotification(Map<String, Object> payload) {
        return new NotificationMessage("notification", createNotification(payload, "NewMessages"));
    }

    /**
     * Creates an ExecutionStateUpdateNotification message.
     *
     * @param payload the notification payload
     * @return a NotificationMessage wrapping an ExecutionStateUpdateNotification
     */
    private NotificationMessage createExecutionStateUpdateNotification(Map<String, Object> payload) {
        return new NotificationMessage("notification", createNotification(payload, "ExecutionStateUpdateNotification"));
    }

    /**
     * Checks if a message is a sidebar-answered message that should be skipped.
     *
     * @param messageDto the message to check
     * @return {@code true} if the message is a sidebar-answered message, {@code false} otherwise
     */
    private boolean isSidebarAnsweredMessage(MessageDto messageDto) {
        return messageDto.getSubmit() != null && Objects.equals(MessageAnswer.SubmitType.SIDEBAR.name(),
                messageDto.getSubmit().getType());
    }

    /**
     * Closes the ActiveMQ message producer session and releases resources.
     *
     * <p>This method should be called during invoker unload or removal to
     * properly clean up ActiveMQ connections.
     */
    public void closeMessageProducerSession() {
        try {
            if (this.producer != null) {
                this.producer.close();
            }
        } catch (JMSException cause) {
            LOGGER.error("#####-CHATBOT-Error while closing message producer session ", cause);
        }
    }
}
