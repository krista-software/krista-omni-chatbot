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

package app.krista.extensions.essentials.collaboration.omnichatbot.utils;

import app.krista.extension.executor.Invoker;
import app.krista.ksdk.storage.StorageProvider;
import org.apache.activemq.artemis.core.config.Configuration;
import org.apache.activemq.artemis.core.config.impl.ConfigurationImpl;
import org.apache.activemq.artemis.core.server.embedded.EmbeddedActiveMQ;
import org.apache.activemq.artemis.api.jms.ActiveMQJMSClient;
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
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Integration tests for {@link ActiveMQProducer} against a REAL embedded Apache
 * Artemis broker (in-VM). Unlike {@link ActiveMQProducerTest} (which mocks the
 * JMS interfaces), these exercise real JMS sessions/producers/topics, so they
 * validate actual broker delivery, real self-heal after a connection close, and
 * real thread-safety of concurrent sends through one shared JMS session.
 *
 * <p>Requires the {@code artemis-server} test dependency (needs network to resolve
 * the first time).
 */
@DisplayName("ActiveMQProducer integration (embedded Artemis)")
class ActiveMQProducerIntegrationTest {

    private static final String TOPIC = "websocket-chatbot-messages";
    private static final String VM_URL = "vm://0";

    private static EmbeddedActiveMQ broker;
    private static ConnectionFactory connectionFactory;

    @BeforeAll
    static void startBroker() throws Exception {
        Configuration config = new ConfigurationImpl()
                .setPersistenceEnabled(false)
                .setSecurityEnabled(false)
                .setJournalDirectory("build/artemis/journal")
                .setBindingsDirectory("build/artemis/bindings")
                .setLargeMessagesDirectory("build/artemis/largemessages")
                .setPagingDirectory("build/artemis/paging")
                .addAcceptorConfiguration("in-vm", VM_URL);
        broker = new EmbeddedActiveMQ();
        broker.setConfiguration(config);
        broker.start();
        connectionFactory = ActiveMQJMSClient.createConnectionFactory(VM_URL, "test-cf");
    }

    @AfterAll
    static void stopBroker() throws Exception {
        if (broker != null) {
            broker.stop();
        }
    }

    /** Hands out fresh real JMS connections to the embedded broker, counting fetches. */
    private static final class BrokerStorageProvider implements StorageProvider {

        private final AtomicInteger fetches = new AtomicInteger();

        int fetches() {
            return fetches.get();
        }

        @Override
        @SuppressWarnings("unchecked")
        public <T> T getStorage(String storageName, Class<T> storageTypeClass) {
            fetches.incrementAndGet();
            try {
                return (T) connectionFactory.createConnection();
            } catch (JMSException cause) {
                throw new RuntimeException(cause);
            }
        }
    }

    private static Invoker mockInvoker() {
        Invoker invoker = mock(Invoker.class);
        when(invoker.getInvokerId()).thenReturn("INV_it");
        return invoker;
    }

    /** A live topic subscriber that collects received text bodies. */
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
            Topic topic = session.createTopic(TOPIC);
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

    @Test
    @DisplayName("publishes to the real topic and a subscriber receives it")
    void publishesAndIsReceived() throws Exception {
        try (TopicCollector collector = new TopicCollector(1)) {
            ActiveMQProducer producer = ActiveMQProducer.create(new BrokerStorageProvider(), mockInvoker());
            producer.sendMessage("hello-real");

            assertThat(collector.latch.await(5, TimeUnit.SECONDS)).isTrue();
            assertThat(collector.received).containsExactly("hello-real");
            producer.close();
        }
    }

    @Test
    @DisplayName("real self-heal: recovers and delivers after its connection is closed underneath it")
    void recoversAfterConnectionClosed() throws Exception {
        try (TopicCollector collector = new TopicCollector(2)) {
            BrokerStorageProvider storage = new BrokerStorageProvider();
            ActiveMQProducer producer = ActiveMQProducer.create(storage, mockInvoker());

            producer.sendMessage("before");

            // Simulate a broker/network-induced close of the producer's own JMS connection.
            closeInternalConnection(producer);

            producer.sendMessage("after"); // must self-heal (recreate) and still deliver

            assertThat(collector.latch.await(5, TimeUnit.SECONDS)).isTrue();
            assertThat(collector.received).containsExactlyInAnyOrder("before", "after");
            assertThat(storage.fetches()).isEqualTo(2); // initial open + one recreate
            producer.close();
        }
    }

    @Test
    @DisplayName("after close(): real send throws and nothing is delivered")
    void afterCloseThrowsAndDeliversNothing() throws Exception {
        try (TopicCollector collector = new TopicCollector(1)) {
            ActiveMQProducer producer = ActiveMQProducer.create(new BrokerStorageProvider(), mockInvoker());
            producer.close();

            assertThatThrownBy(() -> producer.sendMessage("nope"))
                    .isInstanceOf(javax.jms.IllegalStateException.class);

            assertThat(collector.latch.await(1, TimeUnit.SECONDS)).isFalse();
            assertThat(collector.received).isEmpty();
        }
    }

    @Test
    @DisplayName("50 concurrent real senders: broker receives all 50, no loss, no JMS corruption")
    void fiftyConcurrentSenders() throws Exception {
        int senders = 50;
        try (TopicCollector collector = new TopicCollector(senders)) {
            ActiveMQProducer producer = ActiveMQProducer.create(new BrokerStorageProvider(), mockInvoker());

            ExecutorService pool = Executors.newFixedThreadPool(senders);
            CountDownLatch start = new CountDownLatch(1);
            List<Future<?>> futures = new ArrayList<>();
            for (int i = 0; i < senders; i++) {
                final int n = i;
                futures.add(pool.submit(() -> {
                    start.await();
                    producer.sendMessage("msg-" + n);
                    return null;
                }));
            }
            start.countDown();
            for (Future<?> future : futures) {
                future.get(20, TimeUnit.SECONDS); // throws if a send failed/deadlocked
            }
            pool.shutdown();

            assertThat(collector.latch.await(15, TimeUnit.SECONDS)).isTrue();
            assertThat(collector.received).hasSize(senders);
            producer.close();
        }
    }

    /** Reflectively closes the producer's private JMS connection to simulate a broker-side drop. */
    private static void closeInternalConnection(ActiveMQProducer producer) throws Exception {
        Field field = ActiveMQProducer.class.getDeclaredField("connection");
        field.setAccessible(true);
        Connection internal = (Connection) field.get(producer);
        internal.close();
    }
}
