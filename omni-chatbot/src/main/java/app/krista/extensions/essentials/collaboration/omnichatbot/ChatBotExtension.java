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

package app.krista.extensions.essentials.collaboration.omnichatbot;

import app.krista.extension.authorization.RequestAuthenticator;
import app.krista.extension.executor.Invoker;
import app.krista.extension.impl.anno.*;
import app.krista.extension.request.ProtoRequest;
import app.krista.extension.request.ProtoResponse;
import app.krista.extension.request.protos.http.HttpProtocol;
import app.krista.extension.util.ServiceRegistry;
import app.krista.extensions.essentials.collaboration.omnichatbot.contants.Constants;
import app.krista.extensions.essentials.collaboration.omnichatbot.listener.InboxMessageListenerImpl;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.ChatBotMessageSender;
import app.krista.extensions.essentials.collaboration.omnichatbot.store.ConnectionStore;
import app.krista.extensions.essentials.collaboration.omnichatbot.utils.ChatBotUtil;
import app.krista.extensions.util.KeyValueStore;
import app.krista.ksdk.authentication.AuthenticationSettings;
import app.krista.ksdk.context.ExecutionMode;
import app.krista.ksdk.context.RequestContext;
import app.krista.ksdk.invoker.InvokerConfiguration;
import app.krista.ksdk.workspace.Conversation;
import app.krista.omni.sdk.medium.api.MediumService;
import app.krista.omni.sdk.medium.api.impl.InvInbox;
import app.krista.omni.sdk.medium.interactive.InteractiveMediumService;
import app.krista.omni.sdk.medium.text.util.CommonInvokerParameters;
import app.krista.omni.sdk.spi.OmniChannelService;
import app.krista.omni.sdk.spi.impl.monitor.SessionTimeoutMonitor;
import app.krista.omni.sdk.spi.impl.services.ConversationsSearch;
import app.krista.omni.sdk.spi.impl.store.SessionStore;
import com.kristasoft.common.holders.ThreadLocalProxy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.inject.Inject;
import javax.inject.Named;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;

@Java(version = Java.Version.JAVA_21)
@Field.Text(value = Constants.WELCOME_CONVERSATION_NAME)
@Field.Text(value = Constants.UI_CONFIG_JSON, required = false)
@Field.Text(value = CommonInvokerParameters.FALLBACK_CONVERSATION, required = false)
@Domain(id = "catEntryDomain_5fa2fc97-4b17-44cf-b98f-aa91a459a091",
        name = "Collaboration",
        ecosystemId = "catEntryEcosystem_84b53163-327b-4b1b-8c96-9334d292f9f5",
        ecosystemName = "Essentials",
        ecosystemVersion = "788a7124-4da2-4afd-b394-62d9fccd0c80")
@Dependency(name = "Authentication", domainId = "catEntryDomain_db053e8f-a194-4dde-aa6f-701ef7a6b3a7",
        description = "Extension dependency for authentication.")
@Domain(id = "catEntryDomain_db053e8f-a194-4dde-aa6f-701ef7a6b3a7",
        name = "Authentication",
        ecosystemId = "catEntryEcosystem_d3b05047-07b0-4b06-95a3-9fb8f7f608d9",
        ecosystemName = "Krista",
        ecosystemVersion = "279b35ac-aeee-4136-840d-6884f52d0737")
@Extension(version = "2.0.17", jaxrsId = Constants.JAX_RS_ID, implementingDomainIds = "catEntryDomain_5fa2fc97-4b17-44cf-b98f-aa91a459a091", requireWorkspaceAdminRights = true, supportingModes = app.krista.extension.request.ExecutionMode.LIVE, name = "Omni Chatbot")
@StaticResource(path = "docs", file = "docs")
public class ChatBotExtension {

    private static final Logger LOGGER = LoggerFactory.getLogger(ChatBotExtension.class);
    private final Invoker invoker;
    private final Invoker authenticatorInvoker;
    private final ChatBotAuthenticator requestAuthenticator;
    private final InvInbox invokerInbox;
    private final AuthenticationSettings authenticationSettings;
    private final ConversationsSearch conversationsSearch;
    private final RequestContext requestContext;
    private final MediumService mediumService;
    private final app.krista.extensions.essentials.collaboration.omnichatbot.store.SessionStore sessionStore;
    private final ConnectionStore connectionStore;
    private final ChatBotMessageSender messageSender;
    private SessionTimeoutMonitor sessionTimeoutMonitor;
    public final KeyValueStore keyValueStore;
    private final InvokerConfiguration invokerConfiguration;

    // In-memory cache for UI_CONFIG_JSON to avoid repeated database reads
    private final Map<String, String> configCache = new ConcurrentHashMap<>();

    @Inject
    public ChatBotExtension(@Named("self") Invoker invoker,
                            @Named("Authentication") Invoker authenticatorInvoker,
                            ChatBotAuthenticator requestAuthenticator,
                            AuthenticationSettings authenticationSettings,
                            RequestContext requestContext, app.krista.extensions.essentials.collaboration.omnichatbot.store.SessionStore sessionStore,
                            ConnectionStore connectionStore, ChatBotMessageSender messageSender, KeyValueStore keyValueStore, InvokerConfiguration invokerConfiguration) {
        this.invoker = invoker;
        this.authenticatorInvoker = authenticatorInvoker;
        this.requestAuthenticator = requestAuthenticator;
        this.sessionStore = sessionStore;
        this.connectionStore = connectionStore;
        this.keyValueStore = keyValueStore;
        this.invokerConfiguration = invokerConfiguration;
        this.invokerInbox = new InvInbox();
        this.authenticationSettings = authenticationSettings;
        this.conversationsSearch = ConversationsSearch.create(ServiceRegistry.getInstance());
        this.requestContext = requestContext;
        this.mediumService = InteractiveMediumService.getInstance();
        this.messageSender = messageSender;
        System.out.println("#####-CHATBOT EXTENSION CONSTRUCTED...");
    }

    /**
     * Validates the extension setup attributes before the invoker is loaded.
     *
     * <p>This method performs the following validations:
     * <ul>
     *   <li>Verifies that the welcome conversation exists and is unique</li>
     *   <li>Validates the fallback conversation if provided</li>
     *   <li>Ensures the UI config JSON is valid JSON format</li>
     * </ul>
     *
     * @param setupAttributes the map of setup attributes to validate
     * @throws IllegalArgumentException if any validation fails, including missing conversations
     *                                  or invalid JSON format
     */
    @InvokerRequest(InvokerRequest.Type.VALIDATE_ATTRIBUTES)
    public void validateAttributes(Map<String, Object> setupAttributes) {
        String welcomeConversation = (String) setupAttributes.get(Constants.WELCOME_CONVERSATION_NAME);
        isConversationFound(welcomeConversation, Constants.WELCOME_CONVERSATION_NAME);

        String fallbackConversation = (String) setupAttributes.get(Constants.FALLBACK_CONVERSATION);
        if (fallbackConversation != null && !fallbackConversation.isEmpty()) {
            isConversationFound(fallbackConversation, Constants.FALLBACK_CONVERSATION);
        }
    }

    /**
     * Validates that a conversation with the given name exists and is unique.
     *
     * <p>Searches for conversations matching the provided name and filters them
     * by the current execution mode. Throws an exception if no matching conversation
     * is found or if multiple conversations match.
     *
     * @param conversationName the name of the conversation to validate
     * @throws IllegalArgumentException if the conversation is not found or if multiple
     *                                  conversations with the same name exist
     */
    private void isConversationFound(String conversationName, String conversationFlow) {
        List<Conversation> conversations = conversationsSearch.getConversations(conversationName);
        List<Conversation> filteredConversations = conversations
                .stream()
                .filter(conversation -> Objects.equals(conversation.getMode().name(), requestContext.getExecutionMode().name()))
                .toList();
        if (filteredConversations.isEmpty()) {
            throw new IllegalArgumentException(String.format("Conversation \"%s\" not found. Please check the name and try again.", conversationName));
        }
        if (filteredConversations.size() > 1) {
            throw new IllegalArgumentException("Before you validate attributes, ensure that the \""+ conversationFlow +"\" is unique.");
        }
    }

    /**
     * Tests the connection by validating the current invoker attributes.
     *
     * <p>This method is called during the test connection phase to ensure
     * all required attributes are properly configured before the extension is loaded.
     */
    @InvokerRequest(InvokerRequest.Type.TEST_CONNECTION)
    public void testConnection() {
        validateAttributes(invoker.getAttributes());
    }

    /**
     * Initializes the extension when the invoker is loaded.
     *
     * <p>This method performs the following initialization tasks:
     * <ul>
     *   <li>Ensures the invoker inbox exists and sets up the message listener</li>
     *   <li>Adds "omni.com" to supported authentication domains if not already present</li>
     *   <li>Performs session cleanup on first load</li>
     *   <li>Starts the session timeout monitor for LIVE execution mode</li>
     * </ul>
     */
    @InvokerRequest(InvokerRequest.Type.INVOKER_LOADED)
    public void onInvokerLoad() {
        LOGGER.info("#####-CHATBOT INVOKER LOADED...");

        // Migrate uiConfigJson from attributes to keyValueStore (one-time migration)
        migrateUiConfigToKeyValueStore();

        // Load UI config from database to cache for fast access
        loadUiConfigToCache();

        invokerInbox.ensureExists();
        invokerInbox.setMessageListener(new InboxMessageListenerImpl());
        if (!isDomainSupported()) {
            authenticationSettings.addSupportedDomains("omni.com");
        }

        SessionStore sessionStore = SessionStore.create(ServiceRegistry.getInstance());
        // Check if the cleanup has been done already
        if (!sessionStore.isCleanupDone()) {
            sessionStore.deleteAllSession();
            sessionStore.markCleanupDone(); // Mark the cleanup as done
            LOGGER.info("#####-CHATBOT-clean up is done..");
        }

        if (requestContext.getExecutionMode().equals(ExecutionMode.LIVE)) {
            this.sessionTimeoutMonitor = SessionTimeoutMonitor.create(
                    OmniChannelService.getInstance(),
                    ServiceRegistry.getInstance(),
                    ThreadLocalProxy.getAll(), authenticatorInvoker);
            sessionTimeoutMonitor.start();
            sessionTimeoutMonitor.setName("SESSION TIMEOUT " + requestContext.getExecutionMode() + " " + requestContext.getInvokerId());
            LOGGER.info("#####-SESSION TIMEOUT MONITOR STARTED SUCCESSFULLY FOR INSTANCE (InvokerId: {})",
                    requestContext.getInvokerId());
        }

        this.loadDefaultValueOfUiConfig();
    }

    /**
     * Migrate uiConfigJson from attributes to keyValueStore (one-time migration).
     * This method checks if the value exists in keyValueStore. If not, it retrieves
     * the value from attributes and stores it in keyValueStore.
     * Also updates the cache after migration.
     */
    private void migrateUiConfigToKeyValueStore() {
        // Check if the value already exists in keyValueStore
        String existingValue = (String) keyValueStore.get(Constants.UI_CONFIG_JSON);

        if (existingValue == null) {
            // Value doesn't exist in keyValueStore, try to get it from attributes
            Object attributeValue = invoker.getAttributes().get(Constants.UI_CONFIG_JSON);

            if (attributeValue != null) {
                String uiConfigJson = attributeValue.toString();
                try {
                    ChatBotUtil.getConfigMap(uiConfigJson);
                    keyValueStore.put(Constants.UI_CONFIG_JSON, uiConfigJson);
                    // Update cache after migration
                    configCache.put(Constants.UI_CONFIG_JSON, uiConfigJson);
                    LOGGER.info("#####-CHATBOT-UI CONFIG MIGRATED AND CACHED");
                } catch (Exception cause) {
                    LOGGER.error("#####-CHATBOT-INVALID JSON FORMAT FOR UI CONFIG: {}", cause.getMessage());
                }
            } else {
                LOGGER.info("#####-CHATBOT-NO UI CONFIG JSON FOUND IN ATTRIBUTES TO MIGRATE");
            }
        } else {
            LOGGER.info("#####-CHATBOT-UI CONFIG JSON ALREADY EXISTS IN KEY VALUE STORE, SKIPPING MIGRATION");
        }
    }

    // In case if we have to revert back from 17 to 16, then this will be useful (KR-19839)
    // In future we can remove this method completely.
    private void loadDefaultValueOfUiConfig() {
        final Object oldUiConfig = invoker.getAttributes().get(Constants.UI_CONFIG_JSON);
        if (oldUiConfig == null) {
            final Map<String, Object> updatedAttributes = new HashMap<>(invoker.getAttributes());
            updatedAttributes.put(Constants.UI_CONFIG_JSON, "{}");
            try {
                final boolean saved = invokerConfiguration.saveChanges(invoker.getWorkspaceId(), invoker.getInvokerId(), updatedAttributes, "live", false);
                LOGGER.info("#####-CHATBOT: DEFAULT VALUE OF UI CONFIG SAVED TO EMPTY JSON {}", saved);
            } catch (Exception e) {
                LOGGER.error("#####-CHATBOT: ERROR SAVING DEFAULT VALUE OF UI CONFIG: {}", e.getMessage());
            }
        }
    }

    /**
     * Cleans up resources when the invoker is unloaded.
     *
     * <p>This method unsets the inbox message listener and closes the message
     * producer session to release ActiveMQ resources.
     */
    @InvokerRequest(InvokerRequest.Type.INVOKER_UNLOADED)
    public void onInvokerUnload() {
        LOGGER.info("#####-CHATBOT INVOKER UNLOADED...");
        System.out.println("#####-CHATBOT ATTRIBUTES:" + invoker.getAttributes());
        stopSessionTimeoutMonitor();
        this.invokerInbox.unsetMessageListener();
        this.messageSender.closeMessageProducerSession();
        LOGGER.info("#####-CHATBOT-Successfully closed the message producer session on invoker unload: {}", invoker.getInvokerId());
    }

    @InvokerRequest(InvokerRequest.Type.AUTHENTICATOR)
    public RequestAuthenticator getRequestAuthenticator() {
        return requestAuthenticator;
    }

    @InvokerRequest(InvokerRequest.Type.CUSTOM_TABS)
    public Map<String, String> getCustomTabs() {
        return Map.of("Documentation", "static/docs", "Integration Settings", "chatbot/integration/");
    }

    @InvokerRequest(InvokerRequest.Type.PREPARE_CHANGE_ROUTING_ID)
    public void prepareRoutingId(String newRoutingId) {
        // Do nothing here. This is required to support editable routing id of chatbot.
    }

    /**
     * Performs complete cleanup when the invoker is removed.
     *
     * <p>This method cleans up all resources associated with the extension:
     * <ul>
     *   <li>Deletes all medium accounts</li>
     *   <li>Removes all connections from the connection store</li>
     *   <li>Removes all sessions from the session store</li>
     *   <li>Closes the message producer session</li>
     * </ul>
     */
    @InvokerRequest(InvokerRequest.Type.INVOKER_REMOVED)
    public void onInvokerRemoved() {
        stopSessionTimeoutMonitor();
        mediumService.deleteAccounts();
        LOGGER.warn("#####-CHATBOT-Successfully deleted all the accounts on invoker remove: {}", invoker.getInvokerId());
        connectionStore.deleteAll();
        LOGGER.warn("#####-CHATBOT-Successfully removed all the connection from connection store on invoker remove: {}", invoker.getInvokerId());
        sessionStore.deleteAll();
        LOGGER.warn("#####-CHATBOT-Successfully removed all the sessions from session store on invoker remove: {}", invoker.getInvokerId());
        messageSender.closeMessageProducerSession();
        LOGGER.warn("#####-CHATBOT-Successfully closed the message producer session on invoker remove: {}", invoker.getInvokerId());
    }

    /**
     * Forwards authentication requests to the Authentication extension.
     *
     * <p>This method delegates authentication API requests to the bound
     * Authentication extension invoker for processing.
     *
     * @param request the protocol request to forward
     * @return the protocol response from the Authentication extension
     * @throws ExecutionException if the request execution fails
     * @throws InterruptedException if the request is interrupted
     */
    @ApiRequest(pathElement = "authn", protocol = HttpProtocol.PROTOCOL_NAME)
    public ProtoResponse forward(ProtoRequest request) throws ExecutionException, InterruptedException {
        return authenticatorInvoker.handleApiRequest("authn", request).get();
    }

    /**
     * Checks if the "omni.com" domain is already supported for authentication.
     *
     * @return {@code true} if the supported domain is already configured, {@code false} otherwise
     */
    private boolean isDomainSupported() {
        return authenticationSettings.getSupportedDomains().contains(CommonInvokerParameters.SUPPORTED_DOMAIN);
    }

    /**
     * Stop the session timeout monitor for this instance.
     * This method ensures the monitor is properly stopped and cleaned up.
     */
    private void stopSessionTimeoutMonitor() {
        if (sessionTimeoutMonitor != null) {
            sessionTimeoutMonitor.stopMonitor();
            LOGGER.info("#####-SESSION TIMEOUT MONITOR STOPPED SUCCESSFULLY FOR INSTANCE (InvokerId: {})",
                    requestContext.getInvokerId());
            sessionTimeoutMonitor = null;
        } else {
            LOGGER.info("#####-SESSION TIMEOUT MONITOR ALREADY NULL FOR INSTANCE (InvokerId: {})",
                    requestContext.getInvokerId());
        }
    }

    /**
     * Gets the cached UI config JSON value.
     * Returns null if not cached.
     *
     * @return The cached UI config JSON string, or null if not found in cache
     */
    public String getCachedUiConfig() {
        return configCache.get(Constants.UI_CONFIG_JSON);
    }

    /**
     * Updates both the cache and the database with the new UI config JSON value.
     * This ensures data consistency between cache and persistent storage.
     *
     * @param uiConfigJson The UI config JSON string to cache and persist
     */
    public void updateUiConfig(String uiConfigJson) {
        configCache.put(Constants.UI_CONFIG_JSON, uiConfigJson);
        keyValueStore.put(Constants.UI_CONFIG_JSON, uiConfigJson);
        LOGGER.info("#####-CHATBOT UI CONFIG UPDATED IN CACHE AND DATABASE");
    }

    /**
     * Loads the UI config from database into cache.
     * This is typically called during initialization.
     */
    private void loadUiConfigToCache() {
        String uiConfigJson = (String) keyValueStore.get(Constants.UI_CONFIG_JSON);
        if (uiConfigJson != null) {
            configCache.put(Constants.UI_CONFIG_JSON, uiConfigJson);
            LOGGER.info("#####-CHATBOT UI CONFIG LOADED TO CACHE FROM DATABASE");
        } else {
            LOGGER.info("#####-CHATBOT NO UI CONFIG FOUND IN DATABASE TO LOAD TO CACHE");
        }
    }
}
