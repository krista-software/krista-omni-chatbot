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

package app.krista.extensions.essentials.collaboration.omnichatbot.resource;

import app.krista.extension.executor.Invoker;
import app.krista.extension.impl.jaxrs.util.Resources;
import app.krista.extension.request.RoutingInfo;
import app.krista.extensions.essentials.collaboration.omnichatbot.ChatBotExtension;
import app.krista.extensions.essentials.collaboration.omnichatbot.contants.Constants;
import app.krista.extensions.essentials.collaboration.omnichatbot.resource.dto.Configuration;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.ChatBotApiService;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.ChatBotUIService;
import app.krista.extensions.essentials.collaboration.omnichatbot.utils.ChatBotUtil;
import app.krista.extensions.essentials.collaboration.omnichatbot.utils.TranscriptUtils;
import app.krista.ksdk.invoker.InvokerConfiguration;
import app.krista.ksdk.nlp.Language;
import app.krista.omni.sdk.complex_fields.impl.rest.EntitySearchService;
import app.krista.omni.sdk.medium.api.dto.FormResponse;
import app.krista.omni.sdk.medium.api.dto.MessageDto;
import app.krista.omni.sdk.medium.api.dto.SearchEntitiesRequest;
import app.krista.omni.sdk.medium.api.dto.SearchEntitiesResponse;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.inject.Inject;
import javax.ws.rs.*;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Path("/")
public class ChatBotResource {
    private static final Logger LOGGER = LoggerFactory.getLogger(ChatBotResource.class);

    private final ChatBotApiService chatBotApiService;
    private final ChatBotUIService chatBotUIService;
    private final Invoker invoker;
    private final TranscriptUtils transcriptUtils;
    private final InvokerConfiguration invokerConfiguration;
    private final ChatBotExtension chatBotExtension;

    @Inject
    public ChatBotResource(ChatBotApiService chatBotApiService, ChatBotUIService chatBotUIService, Invoker invoker,
                           TranscriptUtils transcriptUtils, InvokerConfiguration invokerConfiguration,
                           ChatBotExtension chatBotExtension) {
        this.chatBotApiService = chatBotApiService;
        this.chatBotUIService = chatBotUIService;
        this.invoker = invoker;
        this.transcriptUtils = transcriptUtils;
        this.invokerConfiguration = invokerConfiguration;
        this.chatBotExtension = chatBotExtension;
    }

    /**
     * Serves UI assets from the embedded resources.
     *
     * @param uriPath the original URI path from the request header
     * @param subPath the sub-path within the UI assets directory
     * @return a Response containing the requested UI asset
     * @throws IOException if the asset cannot be read
     */
    @GET
    @Path("/ui/{subpath: .*}")
    public Response getUIAssets(@HeaderParam("X-Krista-Original-URI") String uriPath,
                                @PathParam("subpath") String subPath) throws IOException {
        return chatBotUIService.getResponse(subPath, invoker);
    }

    /**
     * Serves the integration page for embedding the chatbot on external websites.
     *
     * <p>Returns an HTML page with the chatbot integration script configured
     * with the correct base path for the current invoker.
     *
     * @return a Response containing the integration HTML page
     * @throws IOException if the integration template cannot be read
     */
    @Produces("text/plain")
    @Path("/integration")
    @GET
    public Response integration() throws IOException {
        String basePath = invoker.getRoutingInfo().getRoutingURL(invoker.getRoutingInfo().getRoutingId(),
                RoutingInfo.Type.APPLIANCE) + "/chatbot/";
        String uiConfigJson = ChatBotUtil.getJsonConfig(invoker, chatBotExtension);
        LOGGER.info("#####-INTEGRATION-UI Config JSON: {}", uiConfigJson);
        return Resources.getTranslatedResource(getClass(),
                "integration/index.html", Map.of("_basePath_", basePath, "_uiConfigJson_", uiConfigJson));
    }

    /**
     * Creates a new session or retrieves an existing one for the authenticated user.
     *
     * @param sessionInput a map containing the language code for the session
     * @return the inbox ID associated with the user's session
     */
    @POST
    @Path("/session")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public String createSession(Map<String, String> sessionInput) {
        String languageCode = sessionInput.get("languageCode");
        return chatBotApiService.getOrCreateSession(languageCode);
    }

    @GET
    @Path("/config")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getConfigurationGET() {
        final Configuration configuration = chatBotApiService.getConfiguration();
        return Response.ok(configuration).build();
    }

    @GET
    @Path("/launcher-file")
    @Produces(MediaType.TEXT_PLAIN)
    public Response getCoreLauncherJs() {
        return Response.ok(Constants.LAUNCHER_CORE_FILENAME).build();
    }

    @GET
    @Path("/supportedLanguages")
    @Produces(MediaType.APPLICATION_JSON)
    public Set<Language> getSupportedLanguages() {
        return chatBotApiService.getSupportedLanguages();
    }

    /**
     * Retrieves messages from the specified inbox with pagination support.
     *
     * @param inboxId the unique identifier of the inbox
     * @param inclusive whether to include the message at the offset position
     * @param offset the message offset for pagination (message ID to start from)
     * @param pageSize the maximum number of messages to retrieve (default: 20)
     * @return a list of MessageDto objects representing the messages
     */
    @GET
    @Path("/inboxes/{inboxId}/messages")
    @Produces(MediaType.APPLICATION_JSON)
    public List<MessageDto> getMessages(
            @PathParam("inboxId") String inboxId,
            @QueryParam("inclusive") Boolean inclusive,
            @QueryParam("offset") String offset,
            @DefaultValue("20") @QueryParam("pageSize") int pageSize) {
        return chatBotApiService.getMessages(inboxId, offset, inclusive, pageSize);
    }

    /**
     * Submits a form response answer for a specific message in the inbox.
     *
     * @param inboxId the unique identifier of the inbox
     * @param messageId the unique identifier of the message being answered
     * @param formResponse the form response containing the user's answer
     * @return the updated MessageDto after the answer is submitted
     */
    @PUT
    @Path("/inboxes/{inboxId}/messages/{messageId}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public MessageDto submitMessage(@PathParam("inboxId") String inboxId,
                                    @PathParam("messageId") String messageId,
                                    FormResponse formResponse) {
        return chatBotApiService.submitAnswer(inboxId, messageId, formResponse);
    }

    /**
     * Searches for entities based on the provided search criteria.
     *
     * @param searchEntitiesRequest the search request containing query parameters
     * @return a SearchEntitiesResponse containing the matching entities
     */
    @POST
    @Path("/entities/search")
    @Produces(MediaType.APPLICATION_JSON)
    @Consumes(MediaType.APPLICATION_JSON)
    public SearchEntitiesResponse searchEntity(SearchEntitiesRequest searchEntitiesRequest) {
        EntitySearchService entitySearchService = new EntitySearchService();
        return entitySearchService.searchEntity(searchEntitiesRequest);
    }

    /**
     * Sends the conversation transcript to the configured dashboard callback URL.
     *
     * <p>This endpoint:
     * <ul>
     *   <li>Extracts the inbox ID from the request JSON</li>
     *   <li>Retrieves the conversation transcript for that inbox</li>
     *   <li>Sends the transcript to the Dashboard Callback URL configured in uiConfigJson</li>
     * </ul>
     *
     * @param inboxIdJson JSON string containing the inbox ID
     * @return a Response indicating success (200) or failure (400)
     * @throws IOException if the transcript cannot be sent
     */
    @POST
    @Path("/sendTranscript")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response sendTranscript(String inboxIdJson) throws IOException {
        LOGGER.info("#####-CHATBOT-Received JSON: {}", inboxIdJson);
        String uiConfigJsonStr = ChatBotUtil.getJsonConfig(invoker, chatBotExtension);
        String dashboardCallbackUrl = null;
        JsonObject jsonObject = JsonParser.parseString(uiConfigJsonStr).getAsJsonObject();
        JsonElement callbackElement = jsonObject.get("Dashboard Callback Url");
        if (callbackElement != null && !callbackElement.isJsonNull()) {
            dashboardCallbackUrl = callbackElement.getAsString();
            LOGGER.info("#####-CHATBOT-dashboardCallbackUrl : {}", dashboardCallbackUrl);
        }
        if (dashboardCallbackUrl == null || dashboardCallbackUrl.isEmpty()) {
            return Response.status(400).entity("Dashboard Callback URL is not configured. Add 'Dashboard Callback Url' to the uiConfigJson in the extension settings.").build();
        }
        try {
            // Extract inboxId value from JSON using TranscriptUtils
            String inboxId = transcriptUtils.extractInboxIdValue(inboxIdJson);

            String transcript = transcriptUtils.getTranscript(inboxId);
            String url = dashboardCallbackUrl + "/rest/api/transcript";
            LOGGER.info("#####-CHATBOT-Calling dashboard callback url: {}", url);
            Map<String, Object> requestPayload = new HashMap<>();
            requestPayload.put("Transcript", transcript == null ? "" : transcript);
            requestPayload.put("SessionId", inboxId);
            LOGGER.info("#####-CHATBOT-Request Payload: {}", requestPayload);
            transcriptUtils.sendPostRequest(url, requestPayload);
            return Response.status(200).build();
        } catch (Exception e) {
            LOGGER.error("#####-CHATBOT-Error extracting inboxId from JSON : {}", e.getMessage(), e);
            return Response.status(400).entity("Failed to process transcript request. Ensure the request body contains valid JSON with an 'inboxId' field.").build();
        }
    }

    @POST
    @Path("/saveUIConfig")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response saveUIConfig(String uiConfigJson) {
        // Validate that the input is valid
        try {
            ChatBotUtil.getConfigMap(uiConfigJson);
        } catch (Exception e) {
            LOGGER.error("Invalid JSON format for UI config: {}", e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", "Invalid JSON format: " + e.getMessage());
            return Response.status(Response.Status.BAD_REQUEST).entity(errorResponse).build();
        }

        // Update both cache and database for data consistency
        chatBotExtension.updateUiConfig(uiConfigJson);
        LOGGER.info("#####-CHATBOT UI CONFIG SAVED TO CACHE AND DATABASE: {}", uiConfigJson);

        // Added following code to save the UI config in attributes as well.
        // This will be used in case if we revert version of chatbot to previous version (from 2.0.17)
        final Map<String, Object> updatedAttributes = new HashMap<>(invoker.getAttributes());
        updatedAttributes.put(Constants.UI_CONFIG_JSON, uiConfigJson);
        try {
            invokerConfiguration.saveChanges(invoker.getWorkspaceId(), invoker.getInvokerId(), updatedAttributes, "live", false);
        } catch (Exception e) {
            LOGGER.error("Error saving UI config to attributes: {}", e.getMessage());
        }

        // Return success response with message
        Map<String, Object> successResponse = new HashMap<>();
        successResponse.put("success", true);
        successResponse.put("message", "UI configuration saved successfully");
        return Response.ok(successResponse).build();
    }
}
