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
import app.krista.extensions.essentials.collaboration.omnichatbot.store.ConnectionStore;
import app.krista.extensions.essentials.collaboration.omnichatbot.store.SessionStore;
import app.krista.extensions.essentials.collaboration.omnichatbot.utils.ActiveMQProducer;
import app.krista.ksdk.storage.StorageProvider;
import app.krista.omni.sdk.medium.api.dto.MessageDto;
import app.krista.omni.sdk.medium.api.message.MediumInfo;
import app.krista.omni.sdk.medium.interactive.InteractiveMessageOut;
import org.apache.activemq.artemis.api.jms.ActiveMQJMSClient;
import org.apache.activemq.artemis.core.config.Configuration;
import org.apache.activemq.artemis.core.config.impl.ConfigurationImpl;
import org.apache.activemq.artemis.core.server.embedded.EmbeddedActiveMQ;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import javax.jms.Connection;
import javax.jms.ConnectionFactory;
import javax.jms.JMSException;
import javax.jms.MessageConsumer;
import javax.jms.Session;
import javax.jms.TextMessage;
import javax.jms.Topic;
import java.lang.reflect.Field;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Integration test for {@link ChatBotMessageSender} against a REAL embedded Apache
 * Artemis broker (in-VM). Unlike {@link ChatBotMessageSenderTest} (which mocks JMS),
 * this exercises the ACTUAL production delivery path end-to-end at the messaging layer:
 *
 * <pre>
 *   ChatBotMessageSender.sendMessages()
 *     → ActiveMQProducer.sendMessage()  (real JMS producer)
 *       → real Artemis topic "websocket-chatbot-messages"
 *         → a real topic subscriber
 * </pre>
 *
 * <p>Only {@link SessionStore} + {@link ConnectionStore} are stubbed (they merely
 * supply the inboxId / connectionId). Everything from the sender through the broker
 * is real, so the two KR-21024 backend fixes are validated together over a live bus:
 * <ul>
 *   <li><b>FIX #2 (distributed routing)</b> — the published payload carries the
 *       {@code connectionId} from {@link ConnectionStore} and the {@code inboxId}
 *       from {@link SessionStore}; the subscriber receives it verbatim.</li>
 *   <li><b>FIX #1 (producer self-heal)</b> — after the producer's underlying JMS
 *       connection is closed underneath it, the next send recreates the connection
 *       and STILL delivers (no message lost, no exception surfaced).</li>
 * </ul>
 *
 * <p>Requires the {@code artemis-server} test dependency (already on the classpath).
 */
@DisplayName("ChatBotMessageSender integration (embedded Artemis)")
class ChatBotMessageSenderIntegrationTest {

    /** Topic the sender publishes NewMessages notifications to (ActiveMQProducer.TOPIC_NAME). */
    private static final String DELIVERY_TOPIC = "websocket-chatbot-messages";
    private static final String VM_URL = "vm://0";

    private static final String ACCOUNT_ID = "acc-it";
    private static final String INBOX_ID = "inbox-it-001";
    private static final String CONNECTION_ID = "conn-it-568589fffe75fc9cc2";

    private static EmbeddedActiveMQ broker;
    private static ConnectionFactory connectionFactory;

    @BeforeAll
    static void startBroker() throws Exception {
        Configuration config = new ConfigurationImpl()
                .setPersistenceEnabled(false)
                .setSecurityEnabled(false)
                .setJournalDirectory("build/artemis-sender/journal")
                .setBindingsDirectory("build/artemis-sender/bindings")
                .setLargeMessagesDirectory("build/artemis-sender/largemessages")
                .setPagingDirectory("build/artemis-sender/paging")
                .addAcceptorConfiguration("in-vm", VM_URL);
        broker = new EmbeddedActiveMQ();
        broker.setConfiguration(config);
        broker.start();
        connectionFactory = ActiveMQJMSClient.createConnectionFactory(VM_URL, "sender-it-cf");
    }

    @AfterAll
    static void stopBroker() throws Exception {
        if (broker != null) {
            broker.stop();
        }
    }

    /**
     * Hands out fresh real JMS connections to the embedded broker. ChatBotMessageSender
     * fetches TWO on construction (producer topic + state-consumer topic), then one more
     * on each producer recreate (self-heal).
     */
    private static final class BrokerStorageProvider implements StorageProvider {

        @Override
        @SuppressWarnings("unchecked")
        public <T> T getStorage(String storageName, Class<T> storageTypeClass) {
            try {
                return (T) connectionFactory.createConnection();
            } catch (JMSException cause) {
                throw new RuntimeException(cause);
            }
        }
    }

    /** A live subscriber on the delivery topic that collects received text bodies. */
    private static final class TopicCollector implements AutoCloseable {

        private final Connection connection;
        private final Session session;
        private final MessageConsumer consumer;
        final List<String> received = new CopyOnWriteArrayList<>();
        final CountDownLatch latch;

        TopicCollector(int expected) throws JMSException {
            this.latch = new CountDownLatch(expected);
            this.connection = connectionFactory.createConnection();
            this.session = connection.createSession(false, Session.AUTO_ACKNOWLEDGE);
            Topic topic = session.createTopic(DELIVERY_TOPIC);
            this.consumer = session.createConsumer(topic);
            this.consumer.setMessageListener(message -> {
                try {
                    received.add(((TextMessage) message).getText());
                    latch.countDown();
                } catch (JMSException ignored) {
                    // collector best-effort
                }
            });
            this.connection.start();
        }

        @Override
        public void close() throws JMSException {
            consumer.close();
            session.close();
            connection.close();
        }
    }

    private static Invoker mockInvoker() {
        Invoker invoker = mock(Invoker.class);
        when(invoker.getInvokerId()).thenReturn("INV_sender_it");
        return invoker;
    }

    private static ChatBotMessageSender newSender(SessionStore sessionStore, ConnectionStore connectionStore, AuditService auditService)
            throws Exception {
        return new ChatBotMessageSender(sessionStore, new BrokerStorageProvider(), mockInvoker(), connectionStore, auditService);
    }

    private static InteractiveMessageOut regularOutMessage() {
        MediumInfo mediumInfo = new MediumInfo("CHATBOT", ACCOUNT_ID);
        MessageDto messageDto = new MessageDto("Hello from server", "MessageInform");
        return new InteractiveMessageOut(mediumInfo, messageDto, false, false);
    }

    // ---------------------------------------------------------
    // Tests
    // ---------------------------------------------------------

    @Test
    @DisplayName("routes the message to the real topic carrying the distributed connectionId + inboxId")
    void publishesRoutedPayloadToRealTopic() throws Exception {
        SessionStore sessionStore = mock(SessionStore.class);
        ConnectionStore connectionStore = mock(ConnectionStore.class);
        AuditService auditService = mock(AuditService.class);
        when(sessionStore.get(ACCOUNT_ID)).thenReturn(new SessionDto(INBOX_ID));
        when(connectionStore.get(ACCOUNT_ID)).thenReturn(CONNECTION_ID);

        // Subscriber must exist BEFORE publish — topics do not retain for late subscribers.
        try (TopicCollector collector = new TopicCollector(1)) {
            ChatBotMessageSender sender = newSender(sessionStore, connectionStore, auditService);
            try {
                sender.sendMessages(List.of(regularOutMessage()));

                assertThat(collector.latch.await(5, TimeUnit.SECONDS)).isTrue();
                assertThat(collector.received).hasSize(1);
                String json = collector.received.get(0);
                // FIX #2: routed by the DISTRIBUTED connectionId, not a node-local lookup
                assertThat(json).contains(CONNECTION_ID);
                assertThat(json).contains(INBOX_ID);
                assertThat(json).contains("Hello from server");
                assertThat(json).contains("NewMessages");
            } finally {
                sender.closeMessageProducerSession();
            }
        }
    }

    @Test
    @DisplayName("self-heals: delivers the message even after the producer's connection is closed underneath it")
    void selfHealsAfterProducerConnectionClosed() throws Exception {
        SessionStore sessionStore = mock(SessionStore.class);
        ConnectionStore connectionStore = mock(ConnectionStore.class);
        AuditService auditService = mock(AuditService.class);
        when(sessionStore.get(ACCOUNT_ID)).thenReturn(new SessionDto(INBOX_ID));
        when(connectionStore.get(ACCOUNT_ID)).thenReturn(CONNECTION_ID);

        try (TopicCollector collector = new TopicCollector(2)) {
            ChatBotMessageSender sender = newSender(sessionStore, connectionStore, auditService);
            try {
                sender.sendMessages(List.of(regularOutMessage())); // first delivery

                // Simulate a broker/network-induced close of the producer's own JMS connection.
                closeInternalProducerConnection(sender);

                sender.sendMessages(List.of(regularOutMessage())); // must self-heal and still deliver

                assertThat(collector.latch.await(5, TimeUnit.SECONDS)).isTrue();
                assertThat(collector.received).hasSize(2);
                assertThat(collector.received).allMatch(json -> json.contains(CONNECTION_ID));
            } finally {
                sender.closeMessageProducerSession();
            }
        }
    }

    /** Reflectively closes the sender's producer's private JMS connection to simulate a broker-side drop. */
    private static void closeInternalProducerConnection(ChatBotMessageSender sender) throws Exception {
        Field producerField = ChatBotMessageSender.class.getDeclaredField("producer");
        producerField.setAccessible(true);
        ActiveMQProducer producer = (ActiveMQProducer) producerField.get(sender);

        Field connectionField = ActiveMQProducer.class.getDeclaredField("connection");
        connectionField.setAccessible(true);
        Connection connection = (Connection) connectionField.get(producer);
        connection.close();
    }
}
