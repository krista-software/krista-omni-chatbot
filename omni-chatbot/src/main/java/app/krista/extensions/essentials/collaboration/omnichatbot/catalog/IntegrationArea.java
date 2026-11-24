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

import java.util.*;

import app.krista.extension.executor.ExtensionResponse;
import app.krista.extension.executor.Invoker;
import app.krista.extension.impl.anno.*;
import app.krista.extension.request.RoutingInfo;
import app.krista.extensions.essentials.collaboration.omnichatbot.ChatBotExtension;
import app.krista.extensions.essentials.collaboration.omnichatbot.auth.AuthConstants;
import app.krista.extensions.essentials.collaboration.omnichatbot.contants.Constants;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.ChatBotUIService;
import app.krista.ksdk.accounts.Account;
import app.krista.ksdk.accounts.AccountProvider;
import app.krista.ksdk.context.AuthorizationContext;
import app.krista.ksdk.inboxes.Inbox;
import app.krista.ksdk.inboxes.InboxManager;
import app.krista.ksdk.invoker.InvokerConfiguration;
import app.krista.ksdk.message.Message;
import app.krista.model.field.DisplayNamedValuedField;
import app.krista.omni.sdk.complex_fields.impl.MessageDtoFactory;
import app.krista.omni.sdk.medium.api.dto.MessageDto;
import app.krista.omni.sdk.medium.api.dto.Pages;
import app.krista.omni.sdk.medium.api.message.MediumInfo;
import app.krista.omni.sdk.medium.interactive.InteractiveMediumService;
import app.krista.omni.sdk.medium.interactive.InteractiveMessageIn;
import app.krista.omni.sdk.medium.text.util.CommonInvokerParameters;
import app.krista.omni.sdk.spi.impl.util.Languages;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.inject.Inject;

@Domain(id = "catEntryDomain_5fa2fc97-4b17-44cf-b98f-aa91a459a091",
        name = "Collaboration",
        ecosystemId = "catEntryEcosystem_84b53163-327b-4b1b-8c96-9334d292f9f5",
        ecosystemName = "Essentials",
        ecosystemVersion = "adb6c978-f976-4d3d-b4d4-1e99aa6efdab")
public class IntegrationArea {

    private static final Logger LOGGER = LoggerFactory.getLogger(IntegrationArea.class);

    private final AuthorizationContext authorizationContext;
    private final InteractiveMediumService mediumService;
    private final InboxManager inboxManager;
    private final Invoker invoker;
    private final AccountProvider accountProvider;
    private final ChatBotExtension chatBotExtension;
    private final InvokerConfiguration invokerConfiguration;

    @Inject
    public IntegrationArea(Invoker invoker, AuthorizationContext authorizationContext, InboxManager inboxManager,
                           AccountProvider accountProvider, ChatBotExtension chatBotExtension,
                           InvokerConfiguration invokerConfiguration) {
        this.invoker = invoker;
        this.authorizationContext = authorizationContext;
        this.accountProvider = accountProvider;
        this.mediumService = InteractiveMediumService.getInstance();
        this.inboxManager = inboxManager;
        this.chatBotExtension = chatBotExtension;
        this.invokerConfiguration = invokerConfiguration;
    }

    /**
     * Generates what a customer needs to reach the chatbot: the launcher script tag to
     * embed on their own site, and a link that opens the chatbot directly.
     *
     * <p>The launcher loads its own stylesheet and initialises itself, so the single
     * script tag is all a host page needs.
     *
     * <p>Both replies are RichText, which is rendered as HTML: the anchor becomes a real
     * clickable link, while the script tag is entity-escaped so it stays visible, copyable
     * text (a live script element would render as nothing).
     *
     * @return the integration script and the chatbot URL
     */
    @CatalogRequest(
            id = "localDomainRequest_163d54d1-683e-45e6-b40e-bc0ba2a016fd",
            name = "Get Integration Information",
            description = "Replies with the script tag to embed the chatbot on a website, and a link that opens the chatbot directly.",
            area = "Integration",
            type = CatalogRequest.Type.QUERY_SYSTEM)
    @Field(name = "Integration Script", type = "RichText", required = false, attributes = {@Attribute(name = "visualWidth", value = "L")}, options = {})
    @Field(name = "Chatbot URL", type = "RichText", required = false, attributes = {@Attribute(name = "visualWidth", value = "L")}, options = {})
    public Map<String, Object> getIntegrationScript() {
        String basePath = invoker.getRoutingInfo().getRoutingURL(invoker.getRoutingInfo().getRoutingId(),
                RoutingInfo.Type.APPLIANCE) + "/chatbot/";
        String chatbotUrl = basePath + ChatBotUIService.CDN_CACHE_VERSION + "/ui/";

        Map<String, Object> reply = new LinkedHashMap<>();
        reply.put("Integration Script",
                "&lt;script src=\"" + basePath + "ui/launcher.js\"&gt;&lt;/script&gt;");
        reply.put("Chatbot URL",
                "<a href=\"" + chatbotUrl + "\" target=\"_blank\" rel=\"noopener noreferrer\">Chatbot Link</a>");
        return reply;
    }

    /**
     * Fetches the last message sent by the user to Krista.
     *
     * <p>This catalog request iterates through the user's inbox messages in reverse
     * chronological order to find the most recent message sent by the authenticated user.
     * It uses pagination with a page size of 20 messages to efficiently search through
     * the message history.
     *
     * @return the text content of the last user message, or an empty string if no user messages exist
     */
    @CatalogRequest(
            id = "localDomainRequest_dac8fe88-b416-442a-9676-52ff1f0137d0",
            name = "GetLastUserMessage",
            description = "Fetch the last user message to Krista.",
            area = "Integration",
            type = CatalogRequest.Type.CHANGE_SYSTEM)
    @Field.Text(name = "Message", required = false, attributes = {@Attribute(name = "visualWidth", value = "S")}, options = {})
    public String getLastUserMessage() {
        Account authorizedAccount = (authorizationContext != null && authorizationContext.isAuthenticated())
                ? authorizationContext.getAuthorizedAccount() : null;
        if (authorizedAccount == null) {
            return "";
        }
        InteractiveMessageIn textMediumMessageIn = new InteractiveMessageIn(new MediumInfo(Constants.MEDIUM_TYPE, authorizedAccount.getAccountId()), null);
        Account authenticatedAccount = mediumService.getAuthenticatedAccount(textMediumMessageIn, Languages.ENGLISH.getCode());
        String inboxId = mediumService.getSessionInbox(authenticatedAccount).getInboxId();
        Inbox inbox = inboxManager.getInbox(inboxId);
        List<Message> messages;
        String offset = null;
        do {
            messages = inbox.getMessages(offset, offset == null, -20);
            for (int i = messages.size() - 1; i >= 0; i--) {
                Message message = messages.get(i);
                offset = message.getMessageId();
                if (message.getSender().getAccountId().equals(authenticatedAccount.getAccountId())) {
                    MessageDto msgDto = MessageDtoFactory.create(message);
                    return msgDto.getMessage();
                }
            }
        } while (!messages.isEmpty());
        return "";
    }

    /**
     * Retrieves session information for a user identified by their email address.
     *
     * <p>This catalog request performs the following operations:
     * <ul>
     *   <li>Looks up the account by email address</li>
     *   <li>Retrieves the session inbox for the account</li>
     *   <li>Fetches all messages from the inbox with pagination</li>
     *   <li>Formats the messages into a structured response with name, creation time, and message content</li>
     * </ul>
     *
     * <p>The response includes both a formatted text summary and a structured list of message details.
     *
     * @param email the email address of the user to look up
     * @return a map containing "Info" (formatted text summary) and "Details" (list of message objects)
     */
    @CatalogRequest(
            id = "localDomainRequest_ed05a243-6e02-463f-a6b2-c6b012ed8f8c",
            name = "Get Session Info by Email",
            description = "Get Session Info by Email",
            area = "Integration",
            type = CatalogRequest.Type.CHANGE_SYSTEM)
    @Field(name = "Info", type = "Paragraph", required = false, attributes = {
            @Attribute(name = "visualWidth", value = "L")}, options = {})
    @Field.Desc(name = "Details", type = "[ { Name: Text, Creation Time: Date, Message: Text } ]", required = false)
    public Map<String, Object> getSessionInfoByEmail(
            @Field.Text(name = "Email", required = true, attributes = {
                    @Attribute(name = "visualWidth", value = "S")}, options = {}) String email) {
        Account account = accountProvider.lookupAccount(email);
        InteractiveMessageIn textMediumMessageIn =
                new InteractiveMessageIn(new MediumInfo(Constants.MEDIUM_TYPE, account.getAccountId()), null);
        Account authenticatedAccount = mediumService.getAuthenticatedAccount(textMediumMessageIn, Languages.ENGLISH.getCode());
        String inboxId = mediumService.getSessionInbox(authenticatedAccount).getInboxId();
        Inbox inbox = inboxManager.getInbox(inboxId);
        List<Message> messages;
        List<Map<String, Object>> messageList = new LinkedList<>();
        StringBuilder infoStringBuilder = new StringBuilder();

        Set<String> processedMessageIds = new HashSet<>();

        String offset = null;
        do {
            messages = inbox.getMessages(inboxId, offset, 100, offset == null, account.getAccountId());
            for (int i = messages.size() - 1; i >= 0; i--) {
                Message message = messages.get(i);
                offset = message.getMessageId();

                // Skip if message ID has already been processed
                if (processedMessageIds.contains(message.getMessageId())) {
                    continue;
                }

                processedMessageIds.add(message.getMessageId()); // Mark message as processed

                MessageDto messageDto = MessageDtoFactory.create(message);
                String name = messageDto.getSender().getName();
                long creationTime = messageDto.getCreationTime();
                StringBuilder messageReceivedBuilder = new StringBuilder();
                String messageText = messageDto.getMessage();

                // Append non-empty messageText
                if (messageText != null && !messageText.isEmpty() && !messageText.isBlank()) {
                    messageReceivedBuilder.append(messageText).append("\n");
                }

                // Process fields
                for (Pages page : messageDto.form.getPages()) {
                    for (DisplayNamedValuedField field : page.getFields()) {
                        String fieldName = field.getName();
                        Object fieldValue = field.getValue();
                        messageReceivedBuilder.append(fieldName).append(": ").append(fieldValue).append("\n");
                    }
                }

                String messageReceived = messageReceivedBuilder.toString();

                // Skip if messageReceived is empty
                if (messageReceived.isEmpty()) {
                    continue;
                }

                Map<String, Object> messageInfo = new HashMap<>();
                messageInfo.put("Name", name);
                messageInfo.put("Creation Time", new Date(creationTime));
                messageInfo.put("Message", messageReceived);

                messageList.add(0, messageInfo); // Add to the beginning of the list

                infoStringBuilder.insert(0, "Name: " + name + "\n" +
                        "Creation Time: " + new Date(creationTime) + "\n" +
                        "Message: " + messageReceived + "\n\n");
            }
        } while (!messages.isEmpty());

        String infoString = infoStringBuilder.toString();

        Map<String, Object> result = new HashMap<>();
        result.put("Info", "Session info for email: " + infoString);
        result.put("Details", messageList);

        return result;
    }

    /**
     * Saves the chatbot setup parameters onto this invoker, so a conversation can configure the
     * chatbot at runtime instead of an administrator editing the invoker setup screen by hand.
     *
     * <p>Only the parameters that are supplied are changed: an optional parameter that is omitted
     * keeps its currently stored value, which lets a caller update a single setting without having
     * to resend the rest, while passing an empty text explicitly clears that setting. The welcome
     * conversation is mandatory and is always written.
     *
     * <p>The merged attributes are run through the same validation the setup screen uses
     * ({@link ChatBotExtension#validateAttributes(Map)}): the welcome and fallback conversations must
     * exist and be unique for the current execution mode, and every key in {@code attribute_parameters}
     * must map to an existing workspace attribute. Nothing is persisted when validation fails.
     *
     * <p>{@code trustExtension} is the one setting that is not an attribute: it is the invoker's
     * "Trust Extension" switch, without which guest login fails because the chatbot cannot create
     * accounts. Leave it empty to keep the current setting. <b>Changing it restarts the chatbot</b>,
     * because the rights are applied while the invoker loads, so the conversation that changes it may
     * not receive this response.
     *
     * @param welcomeConversation the conversation started when a user opens the chatbot (optional;
     *                            omit to keep the current value, or pass blank to clear it and greet
     *                            with the Welcome Message instead)
     * @param fallbackConversation the conversation used when Krista cannot match a user request
     * @param sessionTimeout minutes of inactivity after which a chat session ends
     * @param defaultRole the role assigned to newly created guest accounts
     * @param attributeParameters JSON object of workspace attributes to copy onto guest accounts
     * @param trustExtension the "Trust Extension" switch, or empty to leave it unchanged
     * @return a SUCCESS response carrying a "Status" message, or a FAILURE response explaining why
     *         the parameters could not be saved
     */
    @CatalogRequest(
            id = "localDomainRequest_86a839f6-6640-4e7a-b367-0c088f095968",
            name = "Set Setup Parameters",
            description = "Save the chatbot setup parameters on this invoker",
            area = "Integration",
            type = CatalogRequest.Type.CHANGE_SYSTEM)
    @Field.Text(name = "Status", required = false, attributes = {@Attribute(name = "visualWidth", value = "S")}, options = {})
    public ExtensionResponse setSetupParameters(
            @Field.Text(name = Constants.WELCOME_CONVERSATION_NAME, required = false,
                    attributes = {@Attribute(name = "visualWidth", value = "S")}, options = {}) String welcomeConversation,
            @Field.Text(name = CommonInvokerParameters.FALLBACK_CONVERSATION, required = false,
                    attributes = {@Attribute(name = "visualWidth", value = "S")}, options = {}) String fallbackConversation,
            @Field(name = CommonInvokerParameters.SESSION_TIMEOUT, type = "Number", required = false,
                    attributes = {@Attribute(name = "visualWidth", value = "S")}, options = {}) Double sessionTimeout,
            @Field.Text(name = AuthConstants.DEFAULT_ROLE_KEY, required = false,
                    attributes = {@Attribute(name = "visualWidth", value = "S")}, options = {}) String defaultRole,
            @Field.Text(name = AuthConstants.ATTRIBUTE_PARAMETERS, required = false,
                    attributes = {@Attribute(name = "visualWidth", value = "S")}, options = {}) String attributeParameters,
            @Field.Boolean(name = Constants.TRUST_EXTENSION, required = false,
                    description = "Grants the chatbot the workspace-admin rights it needs to create guest "
                            + "accounts. Leave empty to keep the current setting; changing it restarts the chatbot.",
                    attributes = {@Attribute(name = "visualWidth", value = "S")}, options = {}) Boolean trustExtension) {
        // Welcome Conversation is optional: omit it to leave the current setting unchanged,
        // or pass a blank value to clear it — in which case the chatbot greets with the
        // Welcome Message instead. validateAttributes only checks the conversation exists
        // when a non-blank name is set.
        Map<String, Object> attributes = new HashMap<>(invoker.getAttributes());
        if (welcomeConversation != null) {
            // A blank value (incl. whitespace) clears the conversation so the chatbot greets
            // with the Welcome Message; a non-blank value sets it. Omitting it (null) leaves
            // the stored value unchanged.
            attributes.put(Constants.WELCOME_CONVERSATION_NAME,
                    welcomeConversation.isBlank() ? "" : welcomeConversation);
        }
        putIfNotNull(attributes, CommonInvokerParameters.FALLBACK_CONVERSATION, fallbackConversation);
        // Kept as a Double deliberately: the omni SDK reads this attribute behind an
        // "instanceof Double" check and silently falls back to the default timeout for any other
        // numeric type, which would look like the configured value was ignored.
        putIfNotNull(attributes, CommonInvokerParameters.SESSION_TIMEOUT, sessionTimeout);
        putIfNotNull(attributes, AuthConstants.DEFAULT_ROLE_KEY, defaultRole);
        putIfNotNull(attributes, AuthConstants.ATTRIBUTE_PARAMETERS, attributeParameters);
        try {
            chatBotExtension.validateAttributes(attributes);
        } catch (IllegalArgumentException cause) {
            return failure(cause.getMessage(), ExtensionResponse.Error.ExceptionType.INPUT_ERROR);
        } catch (RuntimeException cause) {
            // The conversation and workspace-attribute lookups are backed by remote stores; a store
            // failure is not the caller's input error and must not escape as an unhandled exception.
            LOGGER.error("#####-CHATBOT SETUP-PARAMETERS validation failed unexpectedly", cause);
            return failure("Could not validate the chatbot setup parameters. Please check the extension logs.",
                    ExtensionResponse.Error.ExceptionType.SYSTEM_ERROR);
        }
        // trustExtension is passed through as-is: null leaves the invoker's stored rights alone, which
        // keeps this an attribute-only save. A non-null value that differs from the stored one makes
        // the platform reload the invoker (see the class javadoc on the overload).
        boolean saved = invokerConfiguration.saveChanges(invoker.getWorkspaceId(), invoker.getInvokerId(),
                attributes, "live", false, trustExtension);
        if (!saved) {
            return failure("Could not save the chatbot setup parameters. Please check the extension logs.",
                    ExtensionResponse.Error.ExceptionType.SYSTEM_ERROR);
        }
        // Runtime configuration changes are otherwise invisible to operators; attributeParameters is
        // summarised rather than logged because it is free-form JSON.
        LOGGER.info("#####-CHATBOT SETUP-PARAMETERS saved invokerId={} welcomeConversation={} "
                        + "fallbackConversation={} sessionTimeout={} defaultRole={} attributeParameters={} "
                        + "trustExtension={}",
                invoker.getInvokerId(), welcomeConversation, fallbackConversation, sessionTimeout, defaultRole,
                attributeParameters == null ? "unchanged" : "set",
                trustExtension == null ? "unchanged" : trustExtension);
        Map<String, Object> responseMap = new HashMap<>();
        responseMap.put("Status", "Setup parameters saved successfully.");
        return new ExtensionResponse(ExtensionResponse.Result.SUCCESS, responseMap, null, null, null);
    }

    private static void putIfNotNull(Map<String, Object> attributes, String key, Object value) {
        if (value != null) {
            attributes.put(key, value);
        }
    }

    private static ExtensionResponse failure(String message, ExtensionResponse.Error.ExceptionType exceptionType) {
        return new ExtensionResponse(ExtensionResponse.Result.FAILURE, null,
                new ExtensionResponse.Error(message, System.currentTimeMillis(), exceptionType, null), null, null);
    }

}
