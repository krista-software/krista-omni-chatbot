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

import app.krista.extensions.essentials.collaboration.omnichatbot.resource.dto.InboxRequest;
import app.krista.ksdk.inboxes.Inbox;
import app.krista.ksdk.inboxes.InboxManager;
import app.krista.ksdk.message.Message;
import app.krista.model.field.DisplayNamedValuedField;
import app.krista.omni.sdk.complex_fields.impl.MessageDtoFactory;
import app.krista.omni.sdk.medium.api.dto.MessageDto;
import app.krista.omni.sdk.medium.api.dto.Pages;
import app.krista.omni.sdk.spi.util.GsonJsonMapperImpl;
import com.google.gson.Gson;
import com.google.gson.JsonSyntaxException;
import org.jvnet.hk2.annotations.Service;

import javax.inject.Inject;
import javax.ws.rs.client.Client;
import javax.ws.rs.client.ClientBuilder;
import javax.ws.rs.client.Entity;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.util.*;

/**
 * Utility class for transcript-related operations in the Omni Chatbot extension.
 * 
 * <p>This service provides functionality for:
 * <ul>
 *   <li>Extracting inbox IDs from JSON requests</li>
 *   <li>Retrieving and formatting conversation transcripts</li>
 *   <li>Sending HTTP POST requests with transcript data</li>
 *   <li>Managing message retrieval from inboxes</li>
 * </ul>
 * 
 * <p>The class handles the complete workflow of transcript generation, from parsing
 * JSON input to creating formatted conversation logs and transmitting them via HTTP.
 * 
 * <p>All methods include proper error handling and logging for debugging and monitoring purposes.
 * 
 * @author Krista Extensions Team
 * @version 2.0.15-rc5
 * @since 1.0.0
 */
@Service
public class TranscriptUtils {

    private final InboxManager inboxManager;
    private final Gson gson;
    private static final org.slf4j.Logger logger = org.slf4j.LoggerFactory.getLogger(TranscriptUtils.class);

    /**
     * Constructs a new TranscriptUtils instance with the required dependencies.
     * 
     * @param inboxManager The inbox manager for retrieving messages from inboxes
     */
    @Inject
    public TranscriptUtils(InboxManager inboxManager) {
        this.inboxManager = inboxManager;
        this.gson = new Gson();
    }

    /**
     * Extracts the inbox ID value from a JSON string containing an inbox request.
     * 
     * <p>This method parses the provided JSON string and extracts the inbox ID field.
     * It performs validation to ensure the JSON is well-formed and contains a valid inbox ID.
     * 
     * @param jsonString The JSON string containing the inbox request data
     * @return The extracted inbox ID as a string
     * @throws IllegalArgumentException if the JSON string is null, empty, malformed, 
     *                                  or doesn't contain a valid inbox ID
     */
    public String extractInboxIdValue(String jsonString) {
        if (jsonString == null || jsonString.trim().isEmpty()) {
            throw new IllegalArgumentException("Request body is missing or empty. Provide a valid JSON payload containing the inboxId.");
        }

        try {
            InboxRequest inboxRequest = gson.fromJson(jsonString, InboxRequest.class);

            if (inboxRequest == null || inboxRequest.getInboxId() == null || inboxRequest.getInboxId().trim().isEmpty()) {
                throw new IllegalArgumentException("Missing required field 'inboxId' in the request. Provide a valid inboxId to retrieve the transcript.");
            }

            return inboxRequest.getInboxId();
        } catch (JsonSyntaxException e) {
            throw new IllegalArgumentException("Invalid JSON format in request body. Ensure the payload is valid JSON with the structure: {\"inboxId\": \"<value>\"}. Details: " + e.getMessage(), e);
        }
    }

    /**
     * Sends an HTTP POST request to the specified URL with the given payload.
     * 
     * <p>This method creates a JAX-RS client to send a POST request with JSON content.
     * It handles the complete request lifecycle including client creation, request execution,
     * response processing, and resource cleanup.
     * 
     * @param url The target URL for the POST request
     * @param requestPayload A map containing the data to be sent as JSON in the request body
     * @return The HTTP response status indicating the result of the request
     */
    public Response.Status sendPostRequest(String url, Map<String, Object> requestPayload) {
        Client client = ClientBuilder.newClient();
        WebTarget webTarget = client.target(url);
        try (Response response = webTarget
                .request(MediaType.APPLICATION_JSON)
                .post(Entity.entity(GsonJsonMapperImpl.getInstance().toString(requestPayload), MediaType.APPLICATION_JSON))) {

            if (response.getStatus() == Response.Status.OK.getStatusCode()) {
                return Response.Status.OK;
            } else {
                logger.warn("#####-CHATBOT-POST request to {} returned status: {}", url, response.getStatus());
                return Response.Status.fromStatusCode(response.getStatus());
            }
        } catch (Exception e) {
            logger.error("#####-CHATBOT-POST request to {} failed with exception: {}", url, e.getMessage(), e);
        } finally {
            client.close();
        }
        return Response.Status.BAD_REQUEST;
    }


    /**
     * Retrieves and formats a complete conversation transcript for the specified inbox.
     * 
     * <p>This method orchestrates the entire transcript generation process:
     * <ol>
     *   <li>Retrieves messages from the specified inbox</li>
     *   <li>Formats the messages into a readable transcript</li>
     *   <li>Handles any errors that occur during processing</li>
     * </ol>
     * 
     * @param inboxID The unique identifier of the inbox to retrieve the transcript for
     * @return A formatted transcript string, or null if an error occurs during processing
     */
    public String getTranscript(String inboxID) {
        String transcriptString = null;
        try {
            // Get messages from service
            List<MessageDto> messages = getMessages(inboxID, null, true, 100);
            logger.info("Retrieved : {} messages from inbox", messages.size());

            // Create formatted transcript directly from messages
            transcriptString = createFormattedTranscript(messages);
            // logger.debug("Created formatted transcript: {}", transcriptString);

        } catch (Exception cause) {
            // Log error and return failure response
            logger.error("Error processing transcript: {}", cause.getMessage(), cause);
        }
        return transcriptString;
    }


    /**
     * Retrieves messages from the specified inbox and converts them to DTOs.
     * 
     * <p>This method fetches messages from the inbox using the provided parameters
     * and converts each message to a MessageDto for easier handling and processing.
     * 
     * @param inboxId The unique identifier of the inbox to retrieve messages from
     * @param offset The message ID to use as an offset for pagination (can be null for first page)
     * @param inclusive Whether to include the offset message in the results
     * @param pageSize The maximum number of messages to retrieve
     * @return A list of MessageDto objects representing the retrieved messages
     */
    public List<MessageDto> getMessages(String inboxId, String offset, boolean inclusive, int pageSize) {

        List<MessageDto> messageDtos = new LinkedList<>();
        Inbox inbox = inboxManager.getInbox(inboxId);
        List<Message> messages = inbox.getMessages(offset, inclusive, pageSize);
        for (Message message : messages) {
            MessageDto messageDto = MessageDtoFactory.create(message);
            messageDtos.add(messageDto);
        }
        return messageDtos;
    }


    /**
     * Creates a formatted transcript string from a list of messages.
     * 
     * <p>This method processes messages and creates a human-readable transcript format
     * with bot and user interactions clearly labeled. It handles various message types
     * including text messages and form-based interactions.
     * 
     * <p>Special processing includes:
     * <ul>
     *   <li>Converting scientific notation numbers to standard format</li>
     *   <li>Handling form fields and user responses</li>
     *   <li>Proper formatting with "bot:" and "user:" prefixes</li>
     * </ul>
     * 
     * @param messages List of MessageDto objects to process into a transcript
     * @return A formatted transcript string with bot/user interactions, trimmed of excess whitespace
     */
    public static String createFormattedTranscript(List<MessageDto> messages) {
        StringBuilder formattedTranscript = new StringBuilder();

        for (MessageDto message : messages) {

            if (message.getMessage() != null && !message.getMessage().isEmpty()) {
                formattedTranscript.append("bot: ").append(message.getMessage()).append("\n\n");
            }

            if (message.getForm() != null && message.getForm().getPages() != null) {

                for (Pages page : message.getForm().getPages()) {
                    if (page.getFields() != null) {
                        for (DisplayNamedValuedField field : page.getFields()) {
                            String botMessage = field.getName();
                            String userMessage = field.getValue() != null ? field.getValue().toString() : "";
                            // Handle scientific notation format (e.g., 2.222222222E9 -> 2222222222)
                            // Only process positive exponents, ignore negative exponents
                            if (userMessage.matches("\\d+(\\.\\d+)?E\\+?\\d+")) {
                                try {
                                    double value = Double.parseDouble(userMessage);
                                    userMessage = String.format("%.0f", value);
                                } catch (NumberFormatException e) {
                                    logger.warn("Failed to parse scientific notation: {}", userMessage);
                                    // Keep original value if parsing fails
                                }
                            }

                            // Add the interaction to the transcript
                            formattedTranscript.append("bot: ").append(botMessage).append("\n");
                            formattedTranscript.append("user: ").append(userMessage).append("\n\n");
                        }
                    }
                }
            }
        }

        return formattedTranscript.toString().trim();
    }
}
