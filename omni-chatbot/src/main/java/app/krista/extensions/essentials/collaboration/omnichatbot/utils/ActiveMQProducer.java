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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.jms.Connection;
import javax.jms.DeliveryMode;
import javax.jms.JMSException;
import javax.jms.MessageProducer;
import javax.jms.Session;
import java.io.IOException;

/**
 * ActiveMQ message producer for broadcasting WebSocket messages across nodes.
 *
 * <p>This producer publishes messages to the "websocket-chatbot-messages" topic,
 * enabling distributed message delivery in multi-node deployments.
 *
 * <p>Implements {@link AutoCloseable} for proper resource cleanup.
 */
public class ActiveMQProducer implements AutoCloseable {

    private static final Logger LOGGER = LoggerFactory.getLogger(ActiveMQProducer.class);
    private static final String TOPIC_NAME = "websocket-chatbot-messages";

    private final StorageProvider storageProvider;
    private final String clientId;

    private Connection connection;
    private Session session;
    private MessageProducer producer;
    // Set once close() is called. Distinguishes a deliberate lifecycle shutdown
    // (must NOT self-heal) from a broker/network-induced session close (must self-heal).
    private volatile boolean closed = false;

    /**
     * Creates a new ActiveMQ producer for the chatbot extension.
     *
     * <p>The client ID is generated using the invoker ID and hostname to ensure
     * uniqueness across nodes.
     *
     * @param storageProvider the storage provider for obtaining JMS connections
     * @param invoker the invoker instance for generating the client ID
     * @return a new ActiveMQProducer instance
     * @throws IOException if the hostname cannot be resolved
     * @throws JMSException if the JMS connection or session cannot be created
     */
    public static ActiveMQProducer create(StorageProvider storageProvider, Invoker invoker) throws IOException, JMSException {
        String clientId = "websocket-chatbot-producer-" + invoker.getInvokerId() + "-" + LocalHostInfo.hostName();
        return new ActiveMQProducer(storageProvider, clientId);
    }

    private ActiveMQProducer(StorageProvider storageProvider, String clientId) throws JMSException, IOException {
        this.storageProvider = storageProvider;
        this.clientId = clientId;
        open();
    }

    /**
     * Creates the JMS connection, session and producer.
     */
    private void open() throws JMSException, IOException {
        this.connection = storageProvider.getStorage(clientId, Connection.class);
        this.session = this.connection.createSession(false, Session.AUTO_ACKNOWLEDGE);
        this.producer = this.session.createProducer(this.session.createTopic(TOPIC_NAME));
        // WS frame notifications are transient by nature — if a single message is lost (broker crash before disk-flush)
        // the user just misses one chat frame, which is the same failure mode any WS system already tolerates.
        // PERSISTENT (JMS default) forces the broker to fsync each message and ack the producer before send()
        // returns — adding ~10-50ms of per-message blocking latency. For
        // high-volume conversation flows (e.g. a 50-iteration Repeat Loop emitting 50 Inform messages) this compounds
        // into seconds of dead air between server message creation and client receipt.
        // NON_PERSISTENT lets the broker dispatch without disk durability, returning from send() ~10x faster.
        this.producer.setDeliveryMode(DeliveryMode.NON_PERSISTENT);
    }

    /**
     * Ensures the producer is open, recreating it if it was never opened or was
     * torn down by a previous close.
     */
    private void ensureOpen() throws JMSException {
        if (this.producer != null && this.session != null && this.connection != null) {
            return;
        }
        recreate();
    }

    /**
     * Discards the current (closed/stale) JMS resources and builds fresh ones.
     */
    private void recreate() throws JMSException {
        closeQuietly();
        try {
            open();
        } catch (IOException cause) {
            throw new JMSException("Failed to recreate ActiveMQ producer connection: " + cause.getMessage());
        }
    }

    private void closeQuietly() {
        try {
            if (this.producer != null) {
                this.producer.close();
            }
        } catch (JMSException ignored) {
            // best-effort cleanup
        }
        try {
            if (this.session != null) {
                this.session.close();
            }
        } catch (JMSException ignored) {
            // best-effort cleanup
        }
        try {
            if (this.connection != null) {
                this.connection.close();
            }
        } catch (JMSException ignored) {
            // best-effort cleanup
        }
        this.producer = null;
        this.session = null;
        this.connection = null;
    }

    /**
     * Sends a text message to the ActiveMQ topic.
     *
     * @param message the message content to send
     * @throws JMSException if the message cannot be sent
     */
    public synchronized void sendMessage(String message) throws JMSException {
        if (this.closed) {
            throw new javax.jms.IllegalStateException("ActiveMQ producer is closed");
        }
        try {
            ensureOpen();
            this.producer.send(this.session.createTextMessage(message));
        } catch (JMSException cause) {
            // A deliberate close() must NOT be resurrected — re-throw so a stale
            // sender (e.g. an orphaned monitor) can't revive a shut-down producer
            // and leak a connection.
            if (this.closed) {
                throw cause;
            }
            // Otherwise the session/connection broke underneath us (closed session,
            // broker failover, dropped connection, idle eviction — ANY transient
            // JMS failure). Rebuild once and retry so a stale producer can never
            // silently drop the message; a second failure propagates to the caller.
            LOGGER.warn("#####-CHATBOT-ActiveMQ producer send failed; recreating connection and retrying send", cause);
            recreate();
            this.producer.send(this.session.createTextMessage(message));
        }
    }

    /**
     * Closes the producer, session, and connection resources.
     *
     * @throws JMSException if any resource cannot be closed
     */
    @Override
    public synchronized void close() throws JMSException {
        this.closed = true;
        closeQuietly();
    }
}
