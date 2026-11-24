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
import app.krista.extensions.essentials.collaboration.omnichatbot.audit.AuditService;
import app.krista.extensions.essentials.collaboration.omnichatbot.resource.dto.SessionDto;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.impl.WsConnectionStore;
import app.krista.extensions.essentials.collaboration.omnichatbot.store.ConnectionStore;
import app.krista.extensions.essentials.collaboration.omnichatbot.store.SessionStore;
import app.krista.ksdk.storage.StorageProvider;
import app.krista.omni.sdk.medium.api.dto.MessageDto;
import app.krista.omni.sdk.medium.api.dto.Submit;
import app.krista.omni.sdk.medium.api.message.MediumInfo;
import app.krista.omni.sdk.medium.interactive.InteractiveMessageOut;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;

import javax.jms.*;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link ChatBotMessageSender#sendMessages} focused on the routing
 * changes made for KR-21024.
 *
 * <p>Pre-fix, {@code sendMessages} first called
 * {@code WsConnectionStore.getWsConnectionByAccountId()} — a node-local static map
 * that is wiped on an invoker reload — causing messages to be silently dropped for
 * live sockets authenticated before the upgrade. Post-fix, routing uses the
 * distributed {@link ConnectionStore} exclusively.
 *
 * <p>These tests verify:
 * <ul>
 *   <li>No session found → error-log, no send.</li>
 *   <li>No connectionId found → error-log, no send (was previously a warn + continue).</li>
 *   <li>Sidebar-answered message → silently skipped, no send.</li>
 *   <li>All fields valid → payload sent via ActiveMQ with correct inboxId + connectionId.</li>
 *   <li>{@link WsConnectionStore#getWsConnectionByAccountId} is never called (regression guard).</li>
 * </ul>
 *
 * <p>JMS is mocked (same pattern as {@link app.krista.extensions.essentials.collaboration.omnichatbot.utils.ActiveMQProducerTest})
 * so no broker is required.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ChatBotMessageSender.sendMessages routing (KR-21024)")
class ChatBotMessageSenderTest {

    private static final String ACCOUNT_ID = "acc-test";
    private static final String INBOX_ID = "inbox-001";
    private static final String CONN_ID = "conn-001";

    // --------------------------------------------------------
    // Mock JMS infrastructure (adapted from ActiveMQProducerTest)
    // --------------------------------------------------------

    /**
     * Returns mock JMS connections in FIFO order.
     * Two are needed per ChatBotMessageSender: one for the producer, one for the consumer.
     */
    private static final class QueuedStorageProvider implements StorageProvider {

        private final Deque<Connection> queue = new ArrayDeque<>();
        private final AtomicInteger calls = new AtomicInteger();

        void enqueue(Connection connection) {
            queue.add(connection);
        }

        int calls() {
            return calls.get();
        }

        @Override
        @SuppressWarnings("unchecked")
        public <T> T getStorage(String storageName, Class<T> storageTypeClass) {
            calls.incrementAndGet();
            Connection conn = queue.poll();
            if (conn == null) {
                throw new java.lang.IllegalStateException("Test queued no more connections for: " + storageName);
            }
            return (T) conn;
        }
    }

    private record JmsChain(Connection connection, Session session,
                            MessageProducer producer, MessageConsumer consumer) {
    }

    private static JmsChain newProducerChain() throws Exception {
        Connection connection = mock(Connection.class);
        Session session = mock(Session.class);
        MessageProducer producer = mock(MessageProducer.class);
        when(connection.createSession(anyBoolean(), anyInt())).thenReturn(session);
        when(session.createTopic(anyString())).thenReturn(mock(Topic.class));
        when(session.createProducer(any())).thenReturn(producer);
        // Lazy: only used when a message is actually sent, so error-path tests
        // (no session / no connectionId / sidebar) never hit it — keep it lenient.
        lenient().when(session.createTextMessage(anyString())).thenReturn(mock(TextMessage.class));
        return new JmsChain(connection, session, producer, null);
    }

    private static JmsChain newConsumerChain() throws Exception {
        Connection connection = mock(Connection.class);
        Session session = mock(Session.class);
        MessageConsumer consumer = mock(MessageConsumer.class);
        when(connection.createSession(anyBoolean(), anyInt())).thenReturn(session);
        when(session.createTopic(anyString())).thenReturn(mock(Topic.class));
        when(session.createConsumer(any())).thenReturn(consumer);
        return new JmsChain(connection, session, null, consumer);
    }

    private static Invoker mockInvoker() {
        Invoker invoker = mock(Invoker.class);
        when(invoker.getInvokerId()).thenReturn("INV_test");
        return invoker;
    }

    // --------------------------------------------------------
    // Domain object helpers
    // --------------------------------------------------------

    private static InteractiveMessageOut outMessage(String accountId, MessageDto messageDto) {
        MediumInfo mediumInfo = new MediumInfo("CHATBOT", accountId);
        return new InteractiveMessageOut(mediumInfo, messageDto, false, false);
    }

    private static MessageDto regularMessage() {
        return new MessageDto("Hello", "MessageInform");
    }

    private static MessageDto sidebarAnsweredMessage() {
        // isSidebarAnsweredMessage() checks submit != null && submit.getType().equals("SIDEBAR")
        MessageDto dto = new MessageDto("Answered", MessageDto.TYPE_ANSWERED);
        dto.setSubmit(new Submit("SIDEBAR", "answer-value"));
        return dto;
    }

    // --------------------------------------------------------
    // Test fixtures
    // --------------------------------------------------------

    private JmsChain producerChain;
    private SessionStore sessionStore;
    private ConnectionStore connectionStore;
    private AuditService auditService;
    private ChatBotMessageSender sender;

    @BeforeEach
    void setUp() throws Exception {
        producerChain = newProducerChain();
        JmsChain consumerChain = newConsumerChain();

        QueuedStorageProvider storage = new QueuedStorageProvider();
        storage.enqueue(producerChain.connection()); // for ActiveMQProducer.create()
        storage.enqueue(consumerChain.connection()); // for ActiveMQConsumer.create()

        sessionStore = mock(SessionStore.class);
        connectionStore = mock(ConnectionStore.class);
        auditService = mock(AuditService.class);

        sender = new ChatBotMessageSender(sessionStore, storage, mockInvoker(), connectionStore, auditService);
    }

    // --------------------------------------------------------
    // Tests
    // --------------------------------------------------------

    @Test
    @DisplayName("no session found: logs error and does NOT send any message")
    void noSession_errorAndNoSend() throws Exception {
        when(sessionStore.get(ACCOUNT_ID)).thenReturn(null);

        sender.sendMessages(List.of(outMessage(ACCOUNT_ID, regularMessage())));

        verify(producerChain.producer(), never()).send(any());
    }

    @Test
    @DisplayName("session found but connectionId null: logs error and does NOT send (hard fail)")
    void noConnectionId_errorAndNoSend() throws Exception {
        when(sessionStore.get(ACCOUNT_ID)).thenReturn(new SessionDto(INBOX_ID));
        when(connectionStore.get(ACCOUNT_ID)).thenReturn(null);

        sender.sendMessages(List.of(outMessage(ACCOUNT_ID, regularMessage())));

        verify(producerChain.producer(), never()).send(any());
    }

    @Test
    @DisplayName("sidebar-answered message: silently skipped, no send")
    void sidebarAnswered_skipped() throws Exception {
        when(sessionStore.get(ACCOUNT_ID)).thenReturn(new SessionDto(INBOX_ID));
        when(connectionStore.get(ACCOUNT_ID)).thenReturn(CONN_ID);

        sender.sendMessages(List.of(outMessage(ACCOUNT_ID, sidebarAnsweredMessage())));

        verify(producerChain.producer(), never()).send(any());
    }

    @Test
    @DisplayName("all valid: sends via ActiveMQ with inboxId + connectionId in payload")
    void allValid_sendsPayloadWithInboxAndConnectionId() throws Exception {
        when(sessionStore.get(ACCOUNT_ID)).thenReturn(new SessionDto(INBOX_ID));
        when(connectionStore.get(ACCOUNT_ID)).thenReturn(CONN_ID);

        sender.sendMessages(List.of(outMessage(ACCOUNT_ID, regularMessage())));

        // at minimum one message must be sent to the JMS producer
        verify(producerChain.producer(), atLeastOnce()).send(any());

        // the JSON payload passed to createTextMessage must carry inboxId + connectionId
        ArgumentCaptor<String> jsonCaptor = ArgumentCaptor.forClass(String.class);
        verify(producerChain.session(), atLeastOnce()).createTextMessage(jsonCaptor.capture());
        String payload = jsonCaptor.getAllValues().stream()
                .filter(j -> j.contains("inboxId") && j.contains("connectionId"))
                .findFirst()
                .orElse("");
        assertThat(payload).contains(INBOX_ID);
        assertThat(payload).contains(CONN_ID);
    }

    @Test
    @DisplayName("WsConnectionStore.getWsConnectionByAccountId is NEVER called (regression guard)")
    void wsConnectionStoreNotConsulted() throws Exception {
        when(sessionStore.get(ACCOUNT_ID)).thenReturn(new SessionDto(INBOX_ID));
        when(connectionStore.get(ACCOUNT_ID)).thenReturn(CONN_ID);

        try (MockedStatic<WsConnectionStore> staticStore = mockStatic(WsConnectionStore.class)) {
            sender.sendMessages(List.of(outMessage(ACCOUNT_ID, regularMessage())));

            staticStore.verify(() -> WsConnectionStore.getWsConnectionByAccountId(any()), never());
        }
    }
}
