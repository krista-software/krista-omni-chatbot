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

import app.krista.ksdk.workspace.Conversation;
import app.krista.ksdk.workspace.Topic;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Utility class for handling operations related to topics and conversations.
 */
public final class Topics {
    private static final Logger LOGGER = LoggerFactory.getLogger(Topics.class);

    private Topics() {
    }

    /**
     * Validates the existence of topics in the provided iterable.
     *
     * @param topics The iterable of topics.
     * @return True if topics are present, otherwise throws an IllegalArgumentException.
     * @throws IllegalArgumentException If topics are null or empty.
     */
    public static boolean validate(Iterable<Topic> topics) {
        if (topics == null || !topics.iterator().hasNext()) {
            throw new IllegalArgumentException("No topics available. Ensure the user has the required permissions and the topic configuration is correct.");
        }
        return true;
    }

    /**
     * Validates the existence of a specific topic based on its name.
     *
     * @param topic     The topic to validate.
     * @param topicName The name of the topic.
     * @return True if the topic is present, otherwise throws an IllegalArgumentException.
     * @throws IllegalArgumentException If the topic is null.
     */
    public static boolean validateTopic(Topic topic, String topicName) {
        if (topic == null) {
            throw new IllegalArgumentException("Topic '" + topicName + "' not found. Verify the topic name exists and the user has permission to access it.");
        }
        return true;
    }

    /**
     * Retrieves a topic based on its name from the provided iterable of topics.
     *
     * @param topicName The name of the topic to retrieve.
     * @param topics    The iterable of topics.
     * @return The retrieved Topic object.
     * @throws IllegalStateException If multiple topics with the same name are found.
     */
    public static Topic getTopic(String topicName, Iterable<Topic> topics) {
        Topic topic = null;
        for (Topic currentTopic : topics) {
            if (currentTopic.getTopicName().equals(topicName)) {
                if (topic != null) {
                    throw new IllegalStateException("Duplicate topic detected: Multiple topics named '" + topicName + "' exist. Each topic name must be unique.");
                }
                topic = currentTopic;
            }
        }
        return topic;
    }

    /**
     * Retrieves a conversation based on its name from the provided iterable of conversations.
     *
     * @param conversationName The name of the conversation to retrieve.
     * @param conversations    The iterable of conversations.
     * @return The retrieved Conversation object if found and live, otherwise throws exceptions.
     * @throws IllegalStateException If the conversation is not found or not live.
     */
    public static Conversation getConversation(String conversationName, Iterable<Conversation> conversations) {
        boolean isConversationFound = false;
        for (Conversation conversation : conversations) {
            if (conversation.getConversationName().equals(conversationName)) {
                isConversationFound = true;
                LOGGER.debug("Conversation Found: {}", conversationName);
                if ("LIVE".equals(conversation.getMode().name())) {
                    return conversation;
                }
            }
        }
        if (isConversationFound) {
            throw new IllegalStateException("Conversation '" + conversationName + "' exists but is not in LIVE mode. Set the conversation mode to LIVE to use it.");
        }
        throw new IllegalStateException("Conversation '" + conversationName + "' not found. Verify the conversation name and ensure the user has access permissions.");
    }

    /**
     * Validates the existence of a conversation within a topic based on the conversation name.
     *
     * @param topic            The topic containing conversations.
     * @param conversationName The name of the conversation to validate.
     * @param isOptional       Whether the conversation is optional.
     * @return True if the conversation is valid or optional, otherwise throws exceptions.
     * @throws IllegalStateException If the conversation name is empty, not found, or not accessible.
     */
    public static boolean validateConversation(Topic topic, String conversationName, boolean isOptional) {
        if (ChatBotUtil.isNullOrEmpty(conversationName)) {
            if (isOptional) {
                return false;
            } else {
                throw new IllegalStateException("Conversation name is required but was not provided. Specify a valid conversation name in the configuration.");
            }
        }
        return getConversation(conversationName, topic.getConversations()) != null;
    }
}
