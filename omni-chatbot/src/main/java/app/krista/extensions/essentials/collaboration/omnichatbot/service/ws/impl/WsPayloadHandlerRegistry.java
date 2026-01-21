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

package app.krista.extensions.essentials.collaboration.omnichatbot.service.ws.impl;

import app.krista.extension.util.InvokerAttributeProvider;
import app.krista.extensions.essentials.collaboration.omnichatbot.contants.Constants;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.ws.WsPayloadRequestHandler;
import app.krista.omni.sdk.medium.interactive.InteractiveMediumService;
import app.krista.omni.sdk.spi.util.GsonJsonMapperImpl;
import org.jvnet.hk2.annotations.Service;

import javax.inject.Inject;
import javax.inject.Named;
import java.util.HashMap;
import java.util.Map;

/**
 * Registry for WebSocket payload request handlers.
 *
 * <p>This service maintains a mapping of payload types to their corresponding handlers.
 * Supported payload types are:
 * <ul>
 *   <li>{@code welcome} - triggers the welcome conversation</li>
 *   <li>{@code Message} - handles user text messages</li>
 *   <li>{@code MessageAnswer} - handles form response submissions</li>
 * </ul>
 */
@Service
public class WsPayloadHandlerRegistry {
    private final Map<String, WsPayloadRequestHandler> handlersMap = new HashMap<>();

    /**
     * Registers all payload handlers with their corresponding type keys.
     *
     * <p>This method is called by the HK2 dependency injection framework
     * after construction to initialize the handler registry.
     *
     * @param welcomeConversationProvider provider for the welcome conversation name attribute
     */
    @Inject
    public void registerHandlers(@Named(Constants.WELCOME_CONVERSATION_NAME) InvokerAttributeProvider<String> welcomeConversationProvider) {
        handlersMap.put("welcome", new WsWelcomeMessageHandler(InteractiveMediumService.getInstance(), welcomeConversationProvider));
        handlersMap.put("Message", new WsMessageHandler(InteractiveMediumService.getInstance(), GsonJsonMapperImpl.getInstance()));
        handlersMap.put("MessageAnswer", new WsMessageAnswerHandler(InteractiveMediumService.getInstance(), GsonJsonMapperImpl.getInstance()));
    }

    /**
     * Retrieves the handler for the specified payload type.
     *
     * @param type the payload type (e.g., "welcome", "Message", "MessageAnswer")
     * @return the corresponding WsPayloadRequestHandler, or {@code null} if not found
     */
    public WsPayloadRequestHandler getHandler(String type) {
        return handlersMap.get(type);
    }
}
