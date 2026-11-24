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

import javax.jms.*;
import java.io.IOException;

/**
 * ActiveMQ message consumer for receiving state notifications across nodes.
 *
 * <p>This consumer subscribes to the "chatbot-message-state-notifications" topic
 * to receive execution state updates from other nodes in a multi-node deployment.
 *
 * <p>Implements {@link AutoCloseable} for proper resource cleanup.
 */
public class ActiveMQConsumer implements AutoCloseable {

    private final Connection connection;
    private final Session session;
    private final MessageConsumer consumer;

    /**
     * Creates a new ActiveMQ consumer for the chatbot extension.
     *
     * <p>The client ID is generated using the invoker ID and hostname to ensure
     * uniqueness across nodes.
     *
     * @param storageProvider the storage provider for obtaining JMS connections
     * @param invoker the invoker instance for generating the client ID
     * @return a new ActiveMQConsumer instance
     * @throws IOException if the hostname cannot be resolved
     * @throws JMSException if the JMS connection or session cannot be created
     */
    public static ActiveMQConsumer create(StorageProvider storageProvider, Invoker invoker)
            throws IOException, JMSException {
        String clientId = "websocket-chatbot-consumer-" + invoker.getInvokerId()
                + "-" + LocalHostInfo.hostName();
        return new ActiveMQConsumer(
                storageProvider.getStorage(clientId, Connection.class),
                "chatbot-message-state-notifications"
        );
    }

    private ActiveMQConsumer(Connection connection, String topicName) throws JMSException {
        this.connection = connection;
        this.session = connection.createSession(false, Session.AUTO_ACKNOWLEDGE);
        this.consumer = this.session.createConsumer(session.createTopic(topicName));
    }

    /**
     * Sets the message listener for processing incoming messages.
     *
     * @param listener the message listener to handle incoming messages
     * @throws JMSException if the listener cannot be set
     */
    public void setMessageListener(MessageListener listener) throws JMSException {
        this.consumer.setMessageListener(listener);
    }

    /**
     * Closes the consumer, session, and connection resources.
     *
     * @throws JMSException if any resource cannot be closed
     */
    @Override
    public void close() throws JMSException {
        if (this.consumer != null) {
            this.consumer.close();
        }
        if (this.session != null) {
            this.session.close();
        }
        if (this.connection != null) {
            this.connection.close();
        }
    }
}
