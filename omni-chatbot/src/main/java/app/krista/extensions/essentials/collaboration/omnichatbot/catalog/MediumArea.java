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

package app.krista.extensions.essentials.collaboration.omnichatbot.catalog;

import app.krista.extension.executor.ExtensionResponse;
import app.krista.extension.impl.anno.Attribute;
import app.krista.extension.impl.anno.CatalogRequest;
import app.krista.extension.impl.anno.Domain;
import app.krista.extension.impl.anno.Field;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.ChatBotApiService;
import app.krista.extensions.essentials.collaboration.omnichatbot.utils.TranscriptUtils;
import app.krista.omni.sdk.medium.api.dto.MessageDto;

import javax.inject.Inject;
import java.util.*;

@Domain(id = "catEntryDomain_5fa2fc97-4b17-44cf-b98f-aa91a459a091",
        name = "Collaboration",
        ecosystemId = "catEntryEcosystem_84b53163-327b-4b1b-8c96-9334d292f9f5",
        ecosystemName = "Essentials",
        ecosystemVersion = "788a7124-4da2-4afd-b394-62d9fccd0c80")
public class MediumArea {

    private final ChatBotApiService chatBotApiService;

    @Inject
    public MediumArea(ChatBotApiService chatBotApiService) {
        this.chatBotApiService = chatBotApiService;
    }

    /**
     * Retrieves the session ID for the currently active user.
     *
     * <p>This catalog request creates a new session or retrieves an existing one
     * for the authenticated user with English as the default language.
     *
     * @return the session inbox ID for the active user
     */
    @CatalogRequest(
            id = "localDomainRequest_fa680a04-7cb1-4de2-885b-2a56a174f36a",
            name = "Get Session Id for active user",
            description = "Get Session Id for active user",
            area = "Medium",
            type = CatalogRequest.Type.QUERY_SYSTEM)
    @Field(name = "Session Id", type = "Text", required = false, attributes = {}, options = {})
    public String getSessionIdForActiveUser() {
        return chatBotApiService.getOrCreateSession("en");
    }

    /**
     * Generates a formatted transcript of the conversation for the active user.
     *
     * <p>This catalog request performs the following operations:
     * <ul>
     *   <li>Retrieves or creates a session for the active user</li>
     *   <li>Fetches up to 100 messages from the inbox</li>
     *   <li>Formats the messages into a human-readable transcript</li>
     * </ul>
     *
     * @return an ExtensionResponse containing the formatted transcript on success,
     *         or an error response with details on failure
     */
    @CatalogRequest(
            id = "localDomainRequest_c8226eca-d433-4ab1-acf3-66af64ff7173",
            name = "Get Transcript of the conversation",
            description = "Get Transcript of the conversation using inbox ID",
            area = "Medium",
            type = CatalogRequest.Type.CHANGE_SYSTEM)
    @Field.Text(name = "Transcript", required = false, attributes = {@Attribute(name = "visualWidth", value = "S")}, options = {})
    public ExtensionResponse getTranscriptOfTheConversation()  {
        final String inboxID = chatBotApiService.getOrCreateSession("en");
        try {
            // Get messages from service
            List<MessageDto> messages = chatBotApiService.getMessages(inboxID, null, true, 100);

            // Create formatted transcript directly from messages
            String transcriptString = TranscriptUtils.createFormattedTranscript(messages);

            // Create response
            Map<String, Object> responseMap = new HashMap<>();
            responseMap.put("Transcript", transcriptString);
            return new ExtensionResponse(ExtensionResponse.Result.SUCCESS, responseMap, null, null, null);
        } catch (Exception cause) {
            // Log error and return failure response
            return new ExtensionResponse(ExtensionResponse.Result.FAILURE,
                    null, new ExtensionResponse.Error("Failed to get the transcript of conversation: " + cause.getMessage(), System.currentTimeMillis(), ExtensionResponse.Error.ExceptionType.SYSTEM_ERROR, null),
                    null,
                    null);
        }
    }
}
