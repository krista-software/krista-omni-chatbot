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

package app.krista.extensions.essentials.collaboration.omnichatbot.service;

import app.krista.extension.authorization.AuthorizationException;
import app.krista.extension.executor.Invoker;
import app.krista.extensions.essentials.collaboration.omnichatbot.ChatBotExtension;
import app.krista.extensions.essentials.collaboration.omnichatbot.contants.Constants;
import app.krista.extensions.essentials.collaboration.omnichatbot.metrics.ChatBotMetrics;
import app.krista.extensions.essentials.collaboration.omnichatbot.resource.dto.Configuration;
import app.krista.extensions.essentials.collaboration.omnichatbot.resource.dto.SessionDto;
import app.krista.extensions.essentials.collaboration.omnichatbot.store.SessionStore;
import app.krista.extensions.essentials.collaboration.omnichatbot.utils.ChatBotUtil;
import app.krista.ksdk.accounts.Account;
import app.krista.ksdk.context.AuthorizationContext;
import app.krista.ksdk.context.RuntimeContext;
import app.krista.ksdk.inboxes.Inbox;
import app.krista.ksdk.inboxes.InboxManager;
import app.krista.ksdk.message.Message;
import app.krista.ksdk.message.MessageAnswer;
import app.krista.ksdk.nlp.Language;
import app.krista.ksdk.workspace.Workspace;
import app.krista.omni.sdk.complex_fields.impl.MessageDtoFactory;
import app.krista.omni.sdk.medium.api.dto.FormResponse;
import app.krista.omni.sdk.medium.api.dto.MessageDto;
import app.krista.omni.sdk.medium.api.message.MediumInfo;
import app.krista.omni.sdk.medium.interactive.InteractiveMediumService;
import app.krista.omni.sdk.medium.interactive.InteractiveMessageIn;
import app.krista.omni.sdk.spi.OmniChannelService;
import app.krista.omni.sdk.spi.SessionCreationResult;
import org.jvnet.hk2.annotations.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.inject.Inject;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Service class for ChatBot API operations.
 *
 * @service
 */
@Service
public class ChatBotApiService {

    private final AuthorizationContext authorizationContext;
    private final InboxManager inboxManager;
    private final InteractiveMediumService mediumService;
    private final OmniChannelService omniChannelService;
    private final Workspace workspace;
    private final Invoker invoker;
    private final SessionStore sessionStore;
    private final RuntimeContext runtimeContext;
    private final ChatBotExtension chatBotExtension;

    private static final Logger LOGGER = LoggerFactory.getLogger(ChatBotApiService.class);

    /**
     * Constructs a new ChatBotApiService.
     *
     * @param authorizationContext
     * @param inboxManager         The inbox manager.
     * @param workspace
     * @param invoker
     * @inject
     */
    @Inject
    public ChatBotApiService(AuthorizationContext authorizationContext, InboxManager inboxManager, Workspace workspace,
                             Invoker invoker, SessionStore sessionStore, ChatBotMessageSender chatBotMessageSender,
                             RuntimeContext runtimeContext, ChatBotExtension chatBotExtension) {
        this.authorizationContext = authorizationContext;
        this.inboxManager = inboxManager;
        this.workspace = workspace;
        this.invoker = invoker;
        this.runtimeContext = runtimeContext;
        this.chatBotExtension = chatBotExtension;
        this.omniChannelService = OmniChannelService.getInstance();
        this.mediumService = InteractiveMediumService.getInstance();
        this.sessionStore = sessionStore;
        this.mediumService.registerSender(chatBotMessageSender);
    }

    /**
     * Creates a session for the authenticated user or retrieves an existing one.
     *
     * <p>This method performs the following operations:
     * <ul>
     *   <li>Retrieves the authorized account from the authorization context</li>
     *   <li>Creates an interactive message input with the medium info</li>
     *   <li>Gets or creates an authenticated account with the specified language</li>
     *   <li>Stores the session in the session store</li>
     * </ul>
     *
     * @param languageCode the language code for the session (e.g., "en", "es")
     * @return the inbox ID associated with the user's session
     */
    public String getOrCreateSession(String languageCode) {
        Account authorizedAccount = (authorizationContext != null && authorizationContext.isAuthenticated())
                ? authorizationContext.getAuthorizedAccount() : null;
        if (authorizedAccount == null) {
            LOGGER.error("#####-CHATBOT- NO AUTHORIZED ACCOUNT FOUND IN CONTEXT");
            throw new IllegalStateException("No authorized account found in context");
        }
        return getOrCreateSession(authorizedAccount.getAccountId(), languageCode);
    }

    /**
     * Gets or creates the OmniChannel session for an EXPLICIT account id — independent of the
     * request's {@link AuthorizationContext} — and returns its session inbox (inbox_S_…).
     *
     * <p>Used by the login endpoint to fold the session into login so the SPA needs a single
     * call. A fresh guest login authenticates AS the invoker's runtime account, so its session
     * must be created for the freshly-provisioned guest account (not the context account);
     * returning-user logins pass their own account id to revalidate/recreate a possibly-swept
     * session. Mirrors the context-based variant's SessionStore publish + welcomeExecuted
     * preservation.
     */
    public String getOrCreateSession(String accountId, String languageCode) {
        InteractiveMessageIn textMediumMessageIn = new InteractiveMessageIn(new MediumInfo(Constants.MEDIUM_TYPE, accountId), null);
        // Use the combined getOrCreateSession API to avoid the extra getSessionInbox roundtrip.
        SessionCreationResult result = mediumService.getOrCreateSession(textMediumMessageIn, languageCode);
        String resolvedAccountId = result.account().getAccountId();
        String inboxId = result.sessionInboxId();
        // Preserve welcomeExecuted across re-creates of SessionDto. A normal-login user
        // refreshing the page re-enters this path — without this preservation, the freshly
        // constructed SessionDto would have welcomeExecuted=false, and the next WS open would
        // re-run the welcome conversation on top of the user's in-progress chat. The flag is
        // session-scoped, so as long as the underlying session is the same it must survive
        // this re-put.
        SessionDto existing = sessionStore.get(resolvedAccountId);
        SessionDto sessionDto = new SessionDto(inboxId);
        if (existing != null && existing.isWelcomeExecuted()) {
            sessionDto.setWelcomeExecuted(true);
        }
        sessionStore.put(resolvedAccountId, sessionDto);
        ChatBotMetrics.recordSessionCreated();
        if (existing == null) {
            ChatBotMetrics.recordNewUser();
        }
        return inboxId;
    }

    /**
     * Retrieves messages from the specified inbox with pagination support.
     *
     * <p>Fetches messages from the inbox and converts them to MessageDto objects
     * for API response.
     *
     * @param inboxId the unique identifier of the inbox
     * @param offset the message offset for pagination (message ID to start from)
     * @param inclusive whether to include the message at the offset position
     * @param pageSize the maximum number of messages to retrieve
     * @return a list of MessageDto objects representing the messages
     */
    public List<MessageDto> getMessages(String inboxId, String offset, boolean inclusive, int pageSize) {
        List<MessageDto> messageDtos = new LinkedList<>();
        try {
            Inbox inbox = inboxManager.getInbox(inboxId);
            if (inbox == null) {
                LOGGER.error("#####-CHATBOT- INBOX NOT FOUND FOR INBOX ID: {}", inboxId);
                return messageDtos;
            }
            List<Message> messages = inbox.getMessages(offset, inclusive, pageSize);
            for (Message message : messages) {
                MessageDto messageDto = MessageDtoFactory.create(message);
                messageDtos.add(messageDto);
            }
        } catch (Exception e) {
            LOGGER.error("#####-CHATBOT- ERROR RETRIEVING MESSAGES FOR INBOX ID: {}", inboxId, e);
            ChatBotMetrics.recordError("ChatBotApiService", e);
        }
        return messageDtos;
    }

    /**
     * Retrieves the chatbot configuration including UI settings and workspace information.
     *
     * <p>The configuration includes:
     * <ul>
     *   <li>UI configuration from the uiConfigJson attribute</li>
     *   <li>Workspace ID and logo</li>
     *   <li>Node name from routing info</li>
     *   <li>Multilingual support status</li>
     *   <li>Krista account ID</li>
     * </ul>
     *
     * @return a Configuration object containing the complete chatbot configuration
     * @throws AuthorizationException if authorization context is invalid
     */
    public Configuration getConfiguration() throws AuthorizationException {
        String configJson = ChatBotUtil.getJsonConfig(chatBotExtension);
        Map<String, Object> configMap = ChatBotUtil.getConfigMap(configJson);
        String nodeName = invoker.getRoutingInfo().getNodeName();
        boolean multilingualEnabled = isMultilingualEnabled();
        // Inline the supported-languages list into the config envelope so a
        // multilingual chatbot avoids a separate GET /chatbot/supportedLanguages
        // round-trip on every page load. Empty list when multilingual is off so
        // the FE's canChangeLanguage gate still short-circuits without an API call.
        List<Map<String, String>> supportedLanguageDtos = multilingualEnabled
                ? workspace.getSupportedLanguages().stream()
                        .map(language -> Map.of("code", language.getCode(), "name", language.getName()))
                        .toList()
                : List.of();
        return new Configuration(configMap, workspace.getWorkspaceId(), nodeName, workspace.getWorkspaceLogo(),
                multilingualEnabled, runtimeContext.getKristaAccount().getAccountId(), supportedLanguageDtos);
    }

    /**
     * Submits a form response answer for a specific message in the inbox.
     *
     * <p>Processes the form response by:
     * <ul>
     *   <li>Converting the submit type to the appropriate enum value</li>
     *   <li>Creating a MessageAnswer with the form values</li>
     *   <li>Sending the answer to the omni-channel receiver</li>
     *   <li>Returning the updated message</li>
     * </ul>
     *
     * @param inboxId the unique identifier of the inbox
     * @param messageId the unique identifier of the message being answered
     * @param formResponse the form response containing the user's answer
     * @return the updated MessageDto after the answer is submitted
     */
    public MessageDto submitAnswer(String inboxId, String messageId, FormResponse formResponse) {
        try {
            MessageAnswer.SubmitType submitType = MessageAnswer.SubmitType.valueOf(formResponse.getSubmit().getType().toUpperCase());
            MessageAnswer messageAnswer = MessageAnswer.create(messageId, formResponse.getValues(), submitType, formResponse.getSubmit().getValue());
            omniChannelService.getReceiver().receiveMessageAnswerForInbox(inboxId, messageAnswer);
            // Telemetry only — covers the HTTP submit path (WS messages are counted at the outermost
            // ChatBotProtocolHandler). No account id is resolved on this path. No functional change.
            ChatBotMetrics.recordMessageReceived(submitType.name(), null);
            Inbox inbox = inboxManager.getInbox(inboxId);
            Message message = inbox.getMessage(messageId);
            return MessageDtoFactory.create(message);
        } catch (Exception e) {
            LOGGER.error("#####-CHATBOT- ERROR SUBMITTING ANSWER FOR INBOX ID: {}, MESSAGE ID: {}", inboxId, messageId, e);
            ChatBotMetrics.recordError("ChatBotApiService", e);
            return null;
        }
    }

    /**
     * Retrieves the set of supported languages for the workspace.
     *
     * @return a set of Language objects representing the supported languages
     */
    public Set<Language> getSupportedLanguages() {
        return workspace.getSupportedLanguages();
    }

    /**
     * Checks if multilingual support is enabled for the workspace.
     *
     * @return {@code true} if multilingual support is enabled, {@code false} otherwise
     */
    private boolean isMultilingualEnabled() {
        final Set<Language> supportedLanguages = workspace.getSupportedLanguages();
        return !(supportedLanguages != null
                && supportedLanguages.size() <= 1
                && supportedLanguages.contains(workspace.getLanguage()));
    }
}
