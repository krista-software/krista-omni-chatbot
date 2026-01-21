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

import javax.jms.Connection;
import javax.jms.JMSException;
import javax.jms.MessageProducer;
import javax.jms.Session;
import java.io.IOException;
import java.net.InetAddress;

/**
 * ActiveMQ message producer for broadcasting WebSocket messages across nodes.
 *
 * <p>This producer publishes messages to the "websocket-chatbot-messages" topic,
 * enabling distributed message delivery in multi-node deployments.
 *
 * <p>Implements {@link AutoCloseable} for proper resource cleanup.
 */
public class ActiveMQProducer implements AutoCloseable {

    private final Connection connection;
    private final Session session;
    private final MessageProducer producer;

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
        String clientId = "websocket-chatbot-producer-" + invoker.getInvokerId() + "-" + InetAddress.getLocalHost().getHostName();
        return new ActiveMQProducer(storageProvider.getStorage(clientId, Connection.class));

    }

    private ActiveMQProducer(Connection connection) throws JMSException {
        this.connection = connection;
        this.session = this.connection.createSession(false, Session.AUTO_ACKNOWLEDGE);
        this.producer = this.session.createProducer(this.session.createTopic("websocket-chatbot-messages"));
    }

    /**
     * Sends a text message to the ActiveMQ topic.
     *
     * @param message the message content to send
     * @throws JMSException if the message cannot be sent
     */
    public void sendMessage(String message) throws JMSException {
        this.producer.send(this.session.createTextMessage(message));
    }

    /**
     * Closes the producer, session, and connection resources.
     *
     * @throws JMSException if any resource cannot be closed
     */
    @Override
    public void close() throws JMSException {
        if (this.producer != null) {
            this.producer.close();
        }
        if (this.session != null) {
            this.session.close();
        }
        if (this.connection != null) {
            this.connection.close();
        }
    }
}
