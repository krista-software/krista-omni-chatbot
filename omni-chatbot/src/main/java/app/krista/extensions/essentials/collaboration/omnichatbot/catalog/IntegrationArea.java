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
import java.util.concurrent.ExecutionException;

import app.krista.extension.executor.Invoker;
import app.krista.extension.impl.anno.*;
import app.krista.extension.request.RoutingInfo;
import app.krista.extensions.essentials.collaboration.omnichatbot.contants.Constants;
import app.krista.ksdk.accounts.Account;
import app.krista.ksdk.accounts.AccountProvider;
import app.krista.ksdk.context.AuthorizationContext;
import app.krista.ksdk.inboxes.Inbox;
import app.krista.ksdk.inboxes.InboxManager;
import app.krista.ksdk.message.Message;
import app.krista.model.field.DisplayNamedValuedField;
import app.krista.omni.sdk.complex_fields.impl.MessageDtoFactory;
import app.krista.omni.sdk.medium.api.dto.MessageDto;
import app.krista.omni.sdk.medium.api.dto.Pages;
import app.krista.omni.sdk.medium.api.message.MediumInfo;
import app.krista.omni.sdk.medium.interactive.InteractiveMediumService;
import app.krista.omni.sdk.medium.interactive.InteractiveMessageIn;
import app.krista.omni.sdk.spi.impl.util.Languages;

import javax.inject.Inject;
import javax.inject.Named;

@Domain(id = "catEntryDomain_5fa2fc97-4b17-44cf-b98f-aa91a459a091",
        name = "Collaboration",
        ecosystemId = "catEntryEcosystem_84b53163-327b-4b1b-8c96-9334d292f9f5",
        ecosystemName = "Essentials",
        ecosystemVersion = "adb6c978-f976-4d3d-b4d4-1e99aa6efdab")
public class IntegrationArea {

    private final AuthorizationContext authorizationContext;
    private final InteractiveMediumService mediumService;
    private final InboxManager inboxManager;
    private final Invoker invoker;
    private final Invoker self;
    private final AccountProvider accountProvider;

    @Inject
    public IntegrationArea(@Named("self") Invoker self, @Named("Authentication") Invoker invoker,
                           AuthorizationContext authorizationContext, InboxManager inboxManager, AccountProvider accountProvider) {
        this.self = self;
        this.invoker = invoker;
        this.authorizationContext = authorizationContext;
        this.accountProvider = accountProvider;
        this.mediumService = InteractiveMediumService.getInstance();
        this.inboxManager = inboxManager;
    }

    /**
     * Generates the HTML script element for embedding the chatbot on external websites.
     *
     * <p>This catalog request creates a complete HTML snippet that includes:
     * <ul>
     *   <li>CSS stylesheet link for the launcher</li>
     *   <li>JavaScript file for the launcher</li>
     *   <li>Initialization script with chatbot configuration</li>
     *   <li>Chat bubble SVG icon</li>
     * </ul>
     *
     * <p>If an Authentication extension is bound, it also retrieves and includes
     * the authentication script element.
     *
     * @return the complete HTML script element for chatbot integration
     * @throws ExecutionException if the catalog request to Authentication extension fails
     * @throws InterruptedException if the catalog request is interrupted
     */
    @CatalogRequest(
            id = "localDomainRequest_163d54d1-683e-45e6-b40e-bc0ba2a016fd",
            name = "Get Script Element",
            description = "Get Script Element",
            area = "Integration",
            type = CatalogRequest.Type.QUERY_SYSTEM)
    @Field.Text(name = "Script Element", required = false, attributes = {@Attribute(name = "visualWidth", value = "S")}, options = {})
    public String getScriptElement() throws ExecutionException, InterruptedException {
        String dependency = self.getBindings().get("Authentication");
        String authnScript = "";
        if (!(dependency == null || dependency.isBlank())) {
            Map<String, Object> outputs = invoker.handleCatalogRequest("localDomainRequest_723f4e2c-4f16-4e21-98d4-35184ce1cefb", false, Map.of()).get();
            authnScript = (String) outputs.get("Script Element");
        }

        String basePath = self.getRoutingInfo().getRoutingURL(self.getRoutingInfo().getRoutingId(),
                RoutingInfo.Type.APPLIANCE) + "/chatbot/";

        return "<link rel=\"stylesheet\" href=\"" + basePath + "ui/launcher.css\" />\n" +
                "<script src=\"" + basePath + "ui/launcher.js\"></script>\n" +
                "<script>\n" +
                "    let kristaChat = null;\n" +
                "    function createChatbotClient(data, ref) { // data jwt\n" +
                "      const options = {\n" +
                "        position: 'bottomRight', // bottomRight, centerLeft, centerRight, topLeft, topRight\n" +
                "        transition: 'slideIn', //backIn, bounceIn, fadeIn, lightSpeedIn, rotateInDown, rotateInUp, zoomIn, slideIn,\n" +
                "        host: \"" + basePath + "\",\n" +
                "        chatBubble: {\n" +
                "          cssClass: 'bubble-btn',\n" +
                "          icon: `<svg width=\"60\" height=\"60\" viewBox=\"0 0 60 60\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n" +
                "              <path fill- rule=\"evenodd\" clip - rule=\"evenodd\" d = \"M30 0C13.4315 0 0 13.4315 0 30C0 46.5685 13.4315 60 30 60C35.0129 60 39.7387 58.7705 43.8922 56.5965C44.3533 56.3552 44.8874 56.2858 45.3902 56.4205L55.7458 59.1953C57.2329 59.5938 58.5938 58.2329 58.1953 56.7458L55.563 46.9219C55.418 46.3809 55.5096 45.8058 55.7961 45.3245C58.4663 40.8394 60 35.5988 60 30C60 13.4315 46.5685 0 30 0Z\" fill=\"#3F3920\" />\n" +
                "              <path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M26 34.0898V37C26 37.5523 26.4477 38 27 38H35.5858C35.851 38 36.1054 38.1054 36.2929 38.2929L38.4879 40.4879C38.6769 40.6769 39 40.543 39 40.2757V32C39 31.4477 38.5523 31 38 31V33C38 33.5523 37.5523 34 37 34H26.4142C26.2699 34 26.1288 34.0312 26 34.0898Z\" fill=\"white\" />\n" +
                "              <path d=\"M21 23C21 22.4477 21.4477 22 22 22H35C35.5523 22 36 22.4477 36 23V31C36 31.5523 35.5523 32 35 32H24.4142C24.149 32 23.8946 32.1054 23.7071 32.2929L21.5121 34.4879C21.3231 34.6769 21 34.543 21 34.2757V23Z\" fill=\"white\" />\n" +
                "            </svg >`\n" +
                "        }\n" +
                "      }\n" +
                "      kristaChat = new Chatbot(options);\n" +
                "      kristaChat.init(); \n" +
                "    }\n" +
                "    $(document).ready(function () {\n" +
                "      const ref = {\n" +
                "        chatBubble: $('.chat-bubble')\n" +
                "      }\n" +
                "\n" +
                "        createChatbotClient({}, ref);\n" +
                "    })\n" +
                "  </script>";
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
        Account authorizedAccount = authorizationContext.getAuthorizedAccount();
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

}
