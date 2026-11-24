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
import app.krista.extension.request.RoutingInfo;
import app.krista.extension.util.InvokerAttributes;
import app.krista.extension.util.ServiceRegistry;
import app.krista.extensions.essentials.collaboration.omnichatbot.auth.AttributeParameterValidator;
import app.krista.extensions.essentials.collaboration.omnichatbot.auth.AuthConstants;
import app.krista.extensions.essentials.collaboration.omnichatbot.concurrency.ConcurrencyManager;
import app.krista.extensions.essentials.collaboration.omnichatbot.contants.Constants;
import app.krista.extensions.essentials.collaboration.omnichatbot.filter.CorsResponseFilter;
import app.krista.extensions.essentials.collaboration.omnichatbot.listener.InboxMessageListenerImpl;
import app.krista.extensions.essentials.collaboration.omnichatbot.metrics.ChatBotMetrics;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.ChatBotMessageSender;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.ChatBotUIService;
import app.krista.extensions.essentials.collaboration.omnichatbot.store.ConnectionStore;
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

@Java(version = Java.Version.JAVA_21)
@Field.Text(value = Constants.WELCOME_CONVERSATION_NAME, required = false)
@Field.Text(value = CommonInvokerParameters.FALLBACK_CONVERSATION, required = false)
@Field(name = CommonInvokerParameters.SESSION_TIMEOUT, type = "Number", required = false)
@Field.Text(value = AuthConstants.DEFAULT_ROLE_KEY, required = false)
@Field.Text(value = AuthConstants.ATTRIBUTE_PARAMETERS, required = false)
@Domain(id = "catEntryDomain_5fa2fc97-4b17-44cf-b98f-aa91a459a091",
        name = "Collaboration",
        ecosystemId = "catEntryEcosystem_84b53163-327b-4b1b-8c96-9334d292f9f5",
        ecosystemName = "Essentials",
        ecosystemVersion = "788a7124-4da2-4afd-b394-62d9fccd0c80")
// Authentication (guest-auth) dependency: re-introduced ONLY for this version so
// upgrading customers can migrate their existing Default Role / Session Timeout /
// Attribute Parameters values from the Guest Auth invoker into the chatbot invoker.
// Once migrated, the chatbot invoker is authoritative and this dependency can be
// removed in the next release.
@Dependency(name = "Authentication", domainId = "catEntryDomain_db053e8f-a194-4dde-aa6f-701ef7a6b3a7",
        description = "Extension dependency for authentication. Temporary — used to migrate Guest Auth attributes into the chatbot invoker on upgrade.")
@Domain(id = "catEntryDomain_db053e8f-a194-4dde-aa6f-701ef7a6b3a7",
        name = "Authentication",
        ecosystemId = "catEntryEcosystem_d3b05047-07b0-4b06-95a3-9fb8f7f608d9",
        ecosystemName = "Krista",
        ecosystemVersion = "279b35ac-aeee-4136-840d-6884f52d0737")
@Extension(version = "4.0.0", jaxrsId = Constants.JAX_RS_ID, implementingDomainIds = "catEntryDomain_5fa2fc97-4b17-44cf-b98f-aa91a459a091", requireWorkspaceAdminRights = true, supportingModes = app.krista.extension.request.ExecutionMode.LIVE, name = "Omni Chatbot")
@ChangeLog(file = "docs/pages/change-log.md")
@StaticResource(path = "docs", file = "docs")
public class ChatBotExtension {

    private static final Logger LOGGER = LoggerFactory.getLogger(ChatBotExtension.class);
    private final Invoker invoker;
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
    private final ChatBotPool chatBotPool;
    private final AttributeParameterValidator attributeParameterValidator;
    private final ChatBotUIService chatBotUIService;
    private final ConcurrencyManager concurrencyManager;
    // Bound Authentication (Guest Auth) invoker — temporary, only used during
    // onInvokerLoad to migrate the old Default Role / Session Timeout / Attribute
    // Parameters attributes from the Guest Auth invoker into this chatbot invoker
    // for upgrading customers. Once migrated the chatbot invoker is authoritative.
    private final Invoker authenticationInvoker;

    // In-memory cache for UI_CONFIG_JSON to avoid repeated database reads
    private final Map<String, String> configCache = new ConcurrentHashMap<>();

    @Inject
    public ChatBotExtension(Invoker invoker, ChatBotAuthenticator requestAuthenticator,
                            AuthenticationSettings authenticationSettings, RequestContext requestContext,
                            app.krista.extensions.essentials.collaboration.omnichatbot.store.SessionStore sessionStore,
                            ConnectionStore connectionStore, ChatBotMessageSender messageSender,
                            KeyValueStore keyValueStore, InvokerConfiguration invokerConfiguration, ChatBotPool chatBotPool,
                            AttributeParameterValidator attributeParameterValidator, ChatBotUIService chatBotUIService,
                            ConcurrencyManager concurrencyManager,
                            @Named("Authentication") Invoker authenticationInvoker) {
        this.invoker = invoker;
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
        this.chatBotPool = chatBotPool;
        this.attributeParameterValidator = attributeParameterValidator;
        this.chatBotUIService = chatBotUIService;
        this.concurrencyManager = concurrencyManager;
        this.authenticationInvoker = authenticationInvoker;
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
        // Welcome Conversation is optional: when left blank the chatbot greets with the
        // Welcome Message instead, so only validate the conversation exists when one is set.
        if (welcomeConversation != null && !welcomeConversation.isEmpty()) {
            isConversationFound(welcomeConversation, Constants.WELCOME_CONVERSATION_NAME);
        }

        String fallbackConversation = (String) setupAttributes.get(Constants.FALLBACK_CONVERSATION);
        if (fallbackConversation != null && !fallbackConversation.isEmpty()) {
            isConversationFound(fallbackConversation, Constants.FALLBACK_CONVERSATION);
        }

        validateAttributeParameters(setupAttributes);
    }

    private void validateAttributeParameters(Map<String, Object> setupAttributes) {
        attributeParameterValidator.validate(setupAttributes);
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
        long loadStart = System.nanoTime();
        LOGGER.info("#####-CHATBOT INVOKER LOAD START invokerId={}", invoker.getInvokerId());
        long step = loadStart;

        // Initialise span-based telemetry (events exported via the extension-owned tracer).
        ChatBotMetrics.initialize(invoker.getWorkspaceId(), invoker.getInvokerId());
        ChatBotMetrics.recordInvokerLoaded();

        // Register this chatbot's public host so embed analytics can exclude its own
        // iframe/app/launcher traffic (Host at the origin is internal behind CloudFront).
        registerEmbedSelfHost();
        step = logLoadStep("registerEmbedSelfHost", step);

        // Register the message sender on invoker load to ensure messages work correctly
        // after a version upgrade (the sender must be registered before any messages are sent)
        mediumService.registerSender(messageSender);
        step = logLoadStep("registerSender", step);

        // Load UI config from database to cache for fast access
        loadUiConfigToCache();
        step = logLoadStep("loadUiConfigToCache", step);

        // Load Guest Auth attributes
        migrateGuestAuthAttributesIfNeeded();
        step = logLoadStep("migrateGuestAuthAttributesIfNeeded", step);

        invokerInbox.ensureExists();
        invokerInbox.setMessageListener(new InboxMessageListenerImpl());
        step = logLoadStep("invokerInboxSetup", step);
        if (!isDomainSupported()) {
            authenticationSettings.addSupportedDomains("omni.com");
        }
        step = logLoadStep("domainCheck", step);

        if (requestContext.getExecutionMode().equals(ExecutionMode.LIVE)) {
            OmniChannelService omniChannelService = OmniChannelService.getInstance();
            this.sessionTimeoutMonitor = SessionTimeoutMonitor.create(
                    omniChannelService,
                    ServiceRegistry.getInstance(),
                    ThreadLocalProxy.getAll(), invoker);
            String monitorKey = requestContext.getExecutionMode() + " " + requestContext.getInvokerId();
            sessionTimeoutMonitor.startAndRegister(monitorKey);
            LOGGER.info("#####-SESSION TIMEOUT MONITOR STARTED SUCCESSFULLY FOR INSTANCE (InvokerId: {})",
                    requestContext.getInvokerId());
        }
        step = logLoadStep("sessionTimeoutMonitor", step);

        chatBotPool.changeDefaultRoleAsync();

        // Start the concurrent-user rate-limiting subsystem. rehydrate() rebuilds the
        // queue read-cache from the distributed store (covers extension/proxy restarts);
        // start() launches the background reaper. Both no-op while the feature flag is
        // off, so this is safe to run unconditionally and a later admin toggle activates
        // it without an invoker reload. Independent of the SessionTimeoutMonitor above.
        concurrencyManager.rehydrate();
        step = logLoadStep("concurrencyRehydrate", step);
        concurrencyManager.start();
        step = logLoadStep("concurrencyStart", step);

        // Pre-warm UI asset cache so the first user does not pay cold-cache cost
        // (read + transform + gzip on a 2.9 MB Angular bundle). Runs on a virtual
        // thread to keep invoker boot fast.
        Thread.startVirtualThread(() -> {
            try {
                chatBotUIService.warmCache(invoker);
            } catch (Exception cause) {
                LOGGER.warn("#####-CHATBOT-UI cache warm-up failed: {}", cause.getMessage());
            }
        });

        // Total synchronous load time = the invoker's unavailability window for a reload.
        // Async work (warmCache on a virtual thread, changeDefaultRoleAsync) is not counted.
        LOGGER.info("#####-CHATBOT INVOKER LOAD COMPLETE invokerId={} totalElapsedMs={}",
                invoker.getInvokerId(), (System.nanoTime() - loadStart) / 1_000_000L);
    }

    /**
     * Logs the elapsed time of one synchronous invoker-load step and returns the current
     * nanoTime to seed the next step's start. Runs once per invoker load (upgrade/restart),
     * so INFO volume is negligible. Together these quantify the invoker's unavailability
     * window and reveal which init step dominates it (useful for diagnosing 499 bursts
     * seen at the proxy during upgrades).
     */
    private long logLoadStep(String stepName, long stepStartNanos) {
        long now = System.nanoTime();
        LOGGER.info("#####-CHATBOT-LOAD invokerId={} step={} elapsedMs={}",
                invoker.getInvokerId(), stepName, (now - stepStartNanos) / 1_000_000L);
        return now;
    }

    /**
     * Registers this chatbot's own public host (derived from the invoker routing URL) and
     * invoker id with {@link CorsResponseFilter} so the embed-analytics logging can exclude
     * the chatbot's own iframe/app/launcher traffic and tag entries with the invoker id.
     * This is needed because, behind CloudFront + the hosted-invoker proxy, the {@code Host}
     * header the extension sees is the internal origin and {@code X-Forwarded-Host} is not
     * always present.
     */
    private void registerEmbedSelfHost() {
        try {
            RoutingInfo routingInfo = invoker.getRoutingInfo();
            String routingUrl = routingInfo.getRoutingURL(routingInfo.getRoutingId(), RoutingInfo.Type.APPLIANCE);
            CorsResponseFilter.registerSelfHost(routingUrl);
            CorsResponseFilter.registerInvokerId(invoker.getInvokerId());
        } catch (Exception cause) {
            LOGGER.warn("#####-CHATBOT-EMBED failed to register self host for embed analytics", cause);
        }
    }

    /**
     * One-time migration: copies Default Role / Session Timeout / Attribute
     * Parameters from the bound Authentication (Guest Auth) invoker onto this
     * chatbot invoker, so upgrading customers keep the settings they
     * previously configured on the Guest Auth invoker. Once the chatbot
     * invoker has {@code default_role} set, this method short-circuits and
     * the admin's edits on the chatbot invoker become authoritative.
     */
    private void migrateGuestAuthAttributesIfNeeded() {
        if (invoker.getAttributes().get(AuthConstants.DEFAULT_ROLE_KEY) != null ||
                AuthConstants.DUMMY_INVOKER_ID.equals(authenticationInvoker.getInvokerId())) {
            return;
        }
        try {
            Map<String, Object> authAttrs = authenticationInvoker.getAttributes();
            Map<String, Object> updatedAttributes = new HashMap<>(invoker.getAttributes());
            putIfPresent(updatedAttributes, authAttrs, AuthConstants.DEFAULT_ROLE_KEY);
            putIfPresent(updatedAttributes, authAttrs, CommonInvokerParameters.SESSION_TIMEOUT);
            putIfPresent(updatedAttributes, authAttrs, AuthConstants.ATTRIBUTE_PARAMETERS);
            boolean saved = invokerConfiguration.saveChanges(invoker.getWorkspaceId(), invoker.getInvokerId(), updatedAttributes, "live", false);
            LOGGER.info("#####-CHATBOT GUEST AUTH MIGRATION: copied default_role / session_timeout / attribute_parameters from Authentication invoker (saved={})", saved);
        } catch (Exception cause) {
            LOGGER.warn("#####-CHATBOT GUEST AUTH MIGRATION failed", cause);
        }
    }

    private static void putIfPresent(Map<String, Object> target, Map<String, Object> source, String key) {
        Object value = source.get(key);
        if (value != null) {
            target.put(key, value);
        }
    }

    @InvokerRequest(InvokerRequest.Type.INVOKER_UPDATED)
    public void onInvokerAttributesUpdated(Map<String, Object> oldAttributes, Map<String, Object> newAttributes) {

        String oldRole = InvokerAttributes.getStringOrNull(oldAttributes, AuthConstants.DEFAULT_ROLE_KEY);
        String newRole = InvokerAttributes.getStringOrNull(newAttributes, AuthConstants.DEFAULT_ROLE_KEY);
        if (!Objects.equals(oldRole, newRole)) {
            chatBotPool.changeDefaultRoleAsync();
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
        long unloadStart = System.nanoTime();
        LOGGER.info("#####-CHATBOT INVOKER UNLOAD START invokerId={}", invoker.getInvokerId());
        ChatBotMetrics.shutdown();
        stopSessionTimeoutMonitor();
        concurrencyManager.shutdown();
        chatBotPool.shutdown();
        this.invokerInbox.unsetMessageListener();
        this.messageSender.closeMessageProducerSession();
        // Total unload time = start of the invoker's unavailability window on a reload.
        LOGGER.info("#####-CHATBOT INVOKER UNLOAD COMPLETE invokerId={} elapsedMs={} (producer session closed)",
                invoker.getInvokerId(), (System.nanoTime() - unloadStart) / 1_000_000L);
    }

    @InvokerRequest(InvokerRequest.Type.AUTHENTICATOR)
    public RequestAuthenticator getRequestAuthenticator() {
        return requestAuthenticator;
    }

    @InvokerRequest(InvokerRequest.Type.CUSTOM_TABS)
    public Map<String, String> getCustomTabs() {
        return Map.of(
                "Documentation", "static/docs",
                "Integration Settings", "chatbot/integration/",
                "Analytics & Audit", "chatbot/audit/"
        );
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
        concurrencyManager.shutdown();
        mediumService.deleteAccounts();
        connectionStore.deleteAll();
        sessionStore.deleteAll();
        chatBotPool.deleteAllEntries();
        messageSender.closeMessageProducerSession();
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
     * Returns the UI config JSON, preferring the in-memory cache and falling back to the
     * distributed {@link KeyValueStore} (the durable source of truth) on a cache miss.
     *
     * <p>The KVS fallback is essential right after an invoker upgrade: a freshly created
     * extension instance starts with an empty cache until {@link #loadUiConfigToCache()}
     * runs during {@code onInvokerLoad}. A read that races that window — the Integration
     * Settings page or {@code /config} — would otherwise see no config and render defaults
     * even though a saved config exists in the store. On a cache miss the fetched value is
     * cached so subsequent reads stay in-memory.
     *
     * @return the UI config JSON string, or {@code null} if none has ever been saved
     */
    public String getCachedUiConfig() {
        String cached = configCache.get(Constants.UI_CONFIG_JSON);
        if (cached != null) {
            return cached;
        }
        String stored = (String) keyValueStore.get(Constants.UI_CONFIG_JSON);
        if (stored != null) {
            configCache.put(Constants.UI_CONFIG_JSON, stored);
        }
        return stored;
    }

    public ChatBotPool getChatBotPool() {
        return chatBotPool;
    }

    public ConcurrencyManager getConcurrencyManager() {
        return concurrencyManager;
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
        chatBotPool.refreshCreatePoolUsersFlag(uiConfigJson);
    }

    /**
     * Loads the UI config from database into cache.
     * This is typically called during initialization.
     */
    private void loadUiConfigToCache() {
        String uiConfigJson = (String) keyValueStore.get(Constants.UI_CONFIG_JSON);
        if (uiConfigJson != null) {
            configCache.put(Constants.UI_CONFIG_JSON, uiConfigJson);
        }
    }
}
