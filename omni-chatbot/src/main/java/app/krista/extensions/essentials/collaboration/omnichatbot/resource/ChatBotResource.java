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
import app.krista.extensions.essentials.collaboration.omnichatbot.ChatBotPool;
import app.krista.extensions.essentials.collaboration.omnichatbot.audit.AuditService;
import app.krista.extensions.essentials.collaboration.omnichatbot.contants.Constants;
import app.krista.extensions.essentials.collaboration.omnichatbot.metrics.ChatBotMetrics;
import app.krista.extensions.essentials.collaboration.omnichatbot.resource.dto.Configuration;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.ChatBotApiService;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.ChatBotUIService;
import app.krista.extensions.essentials.collaboration.omnichatbot.utils.ChatBotUtil;
import app.krista.extensions.essentials.collaboration.omnichatbot.utils.TranscriptUtils;
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

@Path("/")
public class ChatBotResource {
    private static final Logger LOGGER = LoggerFactory.getLogger(ChatBotResource.class);

    private final ChatBotApiService chatBotApiService;
    private final ChatBotUIService chatBotUIService;
    private final Invoker invoker;
    private final TranscriptUtils transcriptUtils;
    private final ChatBotExtension chatBotExtension;
    private final ChatBotPool chatBotPool;
    private final AuditService auditService;

    @Inject
    public ChatBotResource(ChatBotApiService chatBotApiService, ChatBotUIService chatBotUIService, Invoker invoker,
                           TranscriptUtils transcriptUtils,
                           ChatBotExtension chatBotExtension, ChatBotPool chatBotPool, AuditService auditService) {
        this.chatBotApiService = chatBotApiService;
        this.chatBotUIService = chatBotUIService;
        this.invoker = invoker;
        this.transcriptUtils = transcriptUtils;
        this.chatBotExtension = chatBotExtension;
        this.chatBotPool = chatBotPool;
        this.auditService = auditService;
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
                                @HeaderParam("Accept-Encoding") String acceptEncoding,
                                @PathParam("subpath") String subPath) throws IOException {
        ChatBotMetrics.recordApiRequest("ui");
        return chatBotUIService.getResponse(subPath, invoker, acceptEncoding);
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
        ChatBotMetrics.recordApiRequest("integration");
        String basePath = invoker.getRoutingInfo().getRoutingURL(invoker.getRoutingInfo().getRoutingId(),
                RoutingInfo.Type.APPLIANCE) + "/chatbot/";
        String uiConfigJson = ChatBotUtil.getJsonConfig(chatBotExtension);
        LOGGER.info("#####-INTEGRATION-UI Config JSON: {}", uiConfigJson);
        return Resources.getTranslatedResource(getClass(),
                "integration/index.html", Map.of("_basePath_", basePath, "_uiConfigJson_", uiConfigJson,
                        "_defaultFallbackMessage_", Constants.DEFAULT_FALLBACK_MESSAGE,
                        "_defaultWelcomeMessage_", Constants.DEFAULT_WELCOME_MESSAGE));
    }

    /**
     * Serves a demo page that loads the chatbot exactly like a customer website:
     * a sample host page containing the one-line launcher integration script.
     *
     * <p>Opened in a new tab from the Integration Settings page ("Try it live") so
     * admins can exercise the full production path (launcher.js &rarr; bubble &rarr;
     * chat iframe) with the saved settings. Chatting here creates a real session,
     * exactly as it would on a customer site. The page is as public as the chatbot
     * itself (guest-accessible by design), so the link can be shared for testing.
     *
     * <p>Freshness: this response carries no Cache-Control header, so
     * {@link app.krista.extensions.essentials.collaboration.omnichatbot.filter.CacheControlResponseFilter}
     * stamps it {@code no-store} &mdash; never cached by browser or CDN. The page sets
     * {@code window.__chatbotPreviewMode}, which makes launcher-core (and, via the
     * {@code chatbotPreview=1} iframe parameter, the chat app) fetch the uncached
     * {@code /preview-config} endpoint, so just-saved settings always show.
     *
     * @return a Response containing the live-preview HTML page
     * @throws IOException if the preview template cannot be read
     */
    @Produces("text/plain")
    @Path("/preview")
    @GET
    public Response preview() throws IOException {
        String basePath = invoker.getRoutingInfo().getRoutingURL(invoker.getRoutingInfo().getRoutingId(),
                RoutingInfo.Type.APPLIANCE) + "/chatbot/";
        return Resources.getTranslatedResource(getClass(), "integration/preview.html",
                Map.of("_basePath_", basePath));
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
        ChatBotMetrics.recordApiRequest("session");
        String languageCode = sessionInput.get("languageCode");
        String sessionInboxId = chatBotApiService.getOrCreateSession(languageCode);
        ChatBotMetrics.recordGuestAccountCreated();
        return sessionInboxId;
    }

    @GET
    @Path("/config")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getConfigurationGET() {
        ChatBotMetrics.recordApiRequest("config");
        final Configuration configuration = chatBotApiService.getConfiguration();
        // Customer-embed endpoint: config is user-independent (workspace/invoker-level)
        // and rarely changes, so both browsers AND the CDN cache it 30 min. Admin saves
        // can therefore take up to the cache TTLs to reach embeds — the Integration
        // Settings live preview instead uses /preview-config, which is never cached.
        return Response.ok(configuration)
                .header("Cache-Control", Constants.resolveCacheControl(Constants.CACHE_PUBLIC_30MIN))
                .build();
    }

    /**
     * Preview-only config endpoint: identical payload to {@code /config} but never
     * cached anywhere ({@code no-store} for both browser and CDN), so the Integration
     * Settings live preview always reflects just-saved settings. A distinct top-level
     * PATH ({@code /preview-config}, NOT a sub-path of {@code /config}) is used
     * deliberately: it can never be matched by a CDN cache behavior scoped to
     * {@code .../config*}, and it reads unambiguously as a separate endpoint.
     * Consumed by launcher-core and the chat iframe when the preview page sets
     * {@code window.__chatbotPreviewMode} / passes {@code chatbotPreview=1}.
     */
    @GET
    @Path("/preview-config")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getConfigurationPreview() {
        return Response.ok(chatBotApiService.getConfiguration())
                .header("Cache-Control", Constants.CACHE_NO_STORE)
                .build();
    }

    @GET
    @Path("/launcher-file")
    @Produces(MediaType.TEXT_PLAIN)
    public Response getCoreLauncherJs() {
        ChatBotMetrics.recordApiRequest("launcher-file");
        return Response.ok(Constants.LAUNCHER_CORE_FILENAME)
                .header("Cache-Control", Constants.resolveCacheControl(Constants.CACHE_PUBLIC_30MIN))
                .build();
    }

    @GET
    @Path("/supportedLanguages")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getSupportedLanguages() {
        ChatBotMetrics.recordApiRequest("supportedLanguages");
        // Serialize to plain code/name maps exactly like the list inlined in /config
        // (ChatBotApiService.getConfiguration): returning the raw kSDK Language set
        // fails JSON serialization (HTTP 500) — a latent bug in this legacy-fallback
        // endpoint that went unnoticed because the app prefers the inlined list.
        final List<Map<String, String>> languages = chatBotApiService.getSupportedLanguages().stream()
                .map(language -> Map.of("code", language.getCode(), "name", language.getName()))
                .toList();
        // Legacy-fallback endpoint (the app prefers the list inlined in /config):
        // browser + CDN cached 30 min, same policy as /config.
        return Response.ok(languages)
                .header("Cache-Control", Constants.resolveCacheControl(Constants.CACHE_PUBLIC_30MIN))
                .build();
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
        ChatBotMetrics.recordApiRequest("inboxes/messages");
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
        ChatBotMetrics.recordApiRequest("inboxes/messages/submit");
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
        ChatBotMetrics.recordApiRequest("entities/search");
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
        ChatBotMetrics.recordApiRequest("sendTranscript");
        String uiConfigJsonStr = ChatBotUtil.getJsonConfig(chatBotExtension);
        String dashboardCallbackUrl = null;
        JsonObject jsonObject = JsonParser.parseString(uiConfigJsonStr).getAsJsonObject();
        JsonElement callbackElement = jsonObject.get("Dashboard Callback Url");
        if (callbackElement != null && !callbackElement.isJsonNull()) {
            dashboardCallbackUrl = callbackElement.getAsString();
        }
        if (dashboardCallbackUrl == null || dashboardCallbackUrl.isEmpty()) {
            return Response.status(400).entity("Dashboard Callback URL is not configured. Add 'Dashboard Callback Url' to the uiConfigJson in the extension settings.").build();
        }
        try {
            // Extract inboxId value from JSON using TranscriptUtils
            String inboxId = transcriptUtils.extractInboxIdValue(inboxIdJson);

            String transcript = transcriptUtils.getTranscript(inboxId);
            String url = dashboardCallbackUrl + "/rest/api/transcript";
            Map<String, Object> requestPayload = new HashMap<>();
            requestPayload.put("Transcript", transcript == null ? "" : transcript);
            requestPayload.put("SessionId", inboxId);
            transcriptUtils.sendPostRequest(url, requestPayload);
            return Response.status(200).build();
        } catch (Exception e) {
            LOGGER.error("#####-CHATBOT-Error extracting inboxId from JSON : {}", e.getMessage(), e);
            ChatBotMetrics.recordError("ChatBotResource", e);
            return Response.status(400).entity("Failed to process transcript request. Ensure the request body contains valid JSON with an 'inboxId' field.").build();
        }
    }

    @POST
    @Path("/saveUIConfig")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response saveUIConfig(String uiConfigJson) {
        ChatBotMetrics.recordApiRequest("saveUIConfig");
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

        // Hand off to the sweep loop so the refill / drain runs in its own
        // thread-local context (captured at pool construction time, has
        // working KSDK auth). Doing this inline from saveUIConfig fails
        // with MustAuthenticateException because the Studio admin request
        // doesn't carry a chatbot-session-id cookie, so the chatbot's
        // per-request AuthorizationContext is unauthenticated and any KSDK
        // round-trip from a captured-and-replayed copy of it returns 500.
        chatBotPool.wakeSweep();
        auditService.recordConfigChanged();

        // Return success response with message
        Map<String, Object> successResponse = new HashMap<>();
        successResponse.put("success", true);
        successResponse.put("message", "UI configuration saved successfully");
        return Response.ok(successResponse).build();
    }
}
