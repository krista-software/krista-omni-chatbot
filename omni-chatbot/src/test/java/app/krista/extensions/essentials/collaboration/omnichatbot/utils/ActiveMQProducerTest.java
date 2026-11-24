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
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import javax.jms.Connection;
import javax.jms.MessageProducer;
import javax.jms.Session;
import javax.jms.TextMessage;
import javax.jms.Topic;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link ActiveMQProducer} focused on the resilience + lifecycle
 * control flow added for KR-21024 (self-heal on a broker-induced "Session is
 * closed", do NOT resurrect after a deliberate close(), and thread-safe sends).
 *
 * <p>The JMS broker is not available offline, so the JMS interfaces
 * ({@link Connection}/{@link Session}/{@link MessageProducer}) are mocked — this
 * is a last-resort mock to exercise the wrapper's own logic. The
 * {@link StorageProvider} is a real fake ({@link QueuedStorageProvider}) so we
 * can count how many times a fresh connection is fetched, which is how we assert
 * "recreated once" vs "never resurrected".
 *
 * <p>True JMS thread-safety + broker semantics + a 50-real-user load test require
 * a real/embedded Artemis broker (see the integration-test plan in the PR).
 */
@DisplayName("ActiveMQProducer resilience + lifecycle")
class ActiveMQProducerTest {

    /**
     * A StorageProvider that hands out pre-queued Connections in order and counts
     * each fetch. One fetch == one (re)open of the producer's JMS resources.
     */
    private static final class QueuedStorageProvider implements StorageProvider {

        private final Deque<Connection> connections = new ArrayDeque<>();
        private final AtomicInteger getStorageCalls = new AtomicInteger();

        void enqueue(Connection connection) {
            connections.add(connection);
        }

        int fetches() {
            return getStorageCalls.get();
        }

        @Override
        @SuppressWarnings("unchecked")
        public <T> T getStorage(String storageName, Class<T> storageTypeClass) {
            getStorageCalls.incrementAndGet();
            Connection connection = connections.poll();
            if (connection == null) {
                throw new IllegalStateException("Test queued no more connections");
            }
            return (T) connection;
        }
    }

    /**
     * A mocked Connection -> Session -> MessageProducer chain, with handles kept
     * for verification.
     */
    private record Chain(Connection connection, Session session, MessageProducer producer) {
    }

    private static Chain newChain() throws Exception {
        Connection connection = mock(Connection.class);
        Session session = mock(Session.class);
        MessageProducer producer = mock(MessageProducer.class);
        when(connection.createSession(anyBoolean(), anyInt())).thenReturn(session);
        when(session.createTopic(anyString())).thenReturn(mock(Topic.class));
        when(session.createProducer(any())).thenReturn(producer);
        when(session.createTextMessage(anyString())).thenReturn(mock(TextMessage.class));
        return new Chain(connection, session, producer);
    }

    private static Invoker mockInvoker() {
        Invoker invoker = mock(Invoker.class);
        when(invoker.getInvokerId()).thenReturn("INV_test");
        return invoker;
    }

    @Test
    @DisplayName("happy path: sends once, no re-open")
    void happyPath_sendsOnce() throws Exception {
        Chain chain = newChain();
        QueuedStorageProvider storage = new QueuedStorageProvider();
        storage.enqueue(chain.connection());

        ActiveMQProducer producer = ActiveMQProducer.create(storage, mockInvoker());
        producer.sendMessage("hello");

        verify(chain.producer(), times(1)).send(any());
        assertThat(storage.fetches()).isEqualTo(1); // only the constructor opened a connection
    }

    @Test
    @DisplayName("broker-induced 'Session is closed': recreates connection and retries once")
    void sessionClosed_recreatesAndRetries() throws Exception {
        Chain stale = newChain();
        // Simulate the broker having closed the session underneath us.
        when(stale.session().createTextMessage(anyString()))
                .thenThrow(new javax.jms.IllegalStateException("Session is closed"));
        Chain fresh = newChain();

        QueuedStorageProvider storage = new QueuedStorageProvider();
        storage.enqueue(stale.connection());  // used by constructor
        storage.enqueue(fresh.connection());  // used by the self-heal recreate

        ActiveMQProducer producer = ActiveMQProducer.create(storage, mockInvoker());
        producer.sendMessage("hello");

        assertThat(storage.fetches()).isEqualTo(2);          // constructor + 1 recreate
        verify(stale.connection(), times(1)).close();         // stale chain torn down
        verify(fresh.producer(), times(1)).send(any());       // message delivered via fresh producer
    }

    @Test
    @DisplayName("after deliberate close(): send throws and does NOT resurrect (no leak)")
    void afterClose_throwsAndDoesNotResurrect() throws Exception {
        Chain chain = newChain();
        QueuedStorageProvider storage = new QueuedStorageProvider();
        storage.enqueue(chain.connection());

        ActiveMQProducer producer = ActiveMQProducer.create(storage, mockInvoker());
        producer.close();
        int fetchesAfterClose = storage.fetches();

        assertThatThrownBy(() -> producer.sendMessage("hello"))
                .isInstanceOf(javax.jms.IllegalStateException.class);

        assertThat(storage.fetches()).isEqualTo(fetchesAfterClose); // no new connection fetched
        verify(chain.producer(), never()).send(any());
    }

    @Test
    @DisplayName("50 concurrent senders: all succeed, serialized through one producer, no re-open")
    void concurrentSenders_allSucceed() throws Exception {
        Chain chain = newChain();
        QueuedStorageProvider storage = new QueuedStorageProvider();
        storage.enqueue(chain.connection());

        ActiveMQProducer producer = ActiveMQProducer.create(storage, mockInvoker());

        int threads = 50;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<?>> futures = new ArrayList<>();
        for (int i = 0; i < threads; i++) {
            futures.add(pool.submit(() -> {
                start.await();
                producer.sendMessage("m");
                return null;
            }));
        }
        start.countDown();
        for (Future<?> future : futures) {
            future.get(15, TimeUnit.SECONDS); // throws if any send failed or deadlocked
        }
        pool.shutdown();

        verify(chain.producer(), times(threads)).send(any());
        assertThat(storage.fetches()).isEqualTo(1); // single shared connection, no spurious recreate
    }
}
