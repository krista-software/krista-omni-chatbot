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

import app.krista.extension.authorization.MustAuthenticateException;
import app.krista.extension.authorization.MustAuthorizeException;
import app.krista.extension.authorization.RequestAuthenticator;
import app.krista.extension.executor.Invoker;
import app.krista.extension.request.ProtoRequest;
import app.krista.extension.request.ProtoResponse;
import app.krista.extension.request.RoutingInfo;
import app.krista.extension.request.protos.http.HttpProtocol;
import app.krista.extension.request.protos.http.HttpRequest;
import app.krista.extension.request.protos.ws.WsConnectionOpened;
import app.krista.extension.request.protos.ws.WsEvent;
import app.krista.extensions.essentials.collaboration.omnichatbot.contants.Constants;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.ws.WsEventHandlerRegistry;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.ws.impl.WsConnectionOpenedHandler;
import app.krista.ksdk.context.AuthorizationContext;
import app.krista.model.field.NamedField;
import app.krista.omni.sdk.complex_fields.impl.FromLinkRequestAuthenticator;
import app.krista.omni.sdk.spi.util.Logger;
import org.jvnet.hk2.annotations.Contract;
import org.jvnet.hk2.annotations.Service;

import javax.inject.Inject;
import javax.inject.Named;
import javax.ws.rs.HttpMethod;
import java.io.IOException;
import java.time.LocalDateTime;
import java.util.*;

@Service
@Contract
public class ChatBotAuthenticator implements RequestAuthenticator {
    private final RequestAuthenticator requestAuthenticator;
    private final AuthorizationContext authorizationContext;
    private final WsEventHandlerRegistry wsEventHandlerRegistry;
    private final Invoker invoker;

    @Inject
    public ChatBotAuthenticator(@Named("Authentication") Invoker authenticationInvoker, AuthorizationContext authorizationContext,
                                WsEventHandlerRegistry wsEventHandlerRegistry, Invoker invoker) {
        this.requestAuthenticator = authenticationInvoker.getRequestAuthenticator();
        this.authorizationContext = authorizationContext;
        this.wsEventHandlerRegistry = wsEventHandlerRegistry;
        this.invoker = invoker;
    }

    @Override
    public String getScheme() {
        return requestAuthenticator.getScheme();
    }

    @Override
    public Set<String> getSupportedProtocols() {
        return requestAuthenticator.getSupportedProtocols();
    }

    /**
     * Authenticates a protocol request and returns the authenticated account ID.
     *
     * <p>This method handles authentication for different request types:
     * <ul>
     *   <li>HTTP requests: Delegates to the bound Authentication extension after updating headers</li>
     *   <li>WebSocket events: Handles via the WebSocket event handler registry</li>
     *   <li>Entity search requests: Uses FromLinkRequestAuthenticator</li>
     *   <li>Config/sendTranscript requests: Returns the already authorized account ID</li>
     * </ul>
     *
     * @param protoRequest the protocol request to authenticate
     * @return the authenticated account ID, or {@code null} if authentication fails
     */
    @Override
    public String getAuthenticatedAccountId(ProtoRequest protoRequest) {
        try {
            if (protoRequest instanceof HttpRequest) {
                HttpRequest httpRequest = (HttpRequest) protoRequest;
                httpRequest.bufferBody();
                String httpRequestMethod = httpRequest.getMethod();
                String uriString = httpRequest.getUri().toString();
                FromLinkRequestAuthenticator fromLinkRequestAuthenticator = new FromLinkRequestAuthenticator();
                if ((HttpMethod.POST.equalsIgnoreCase(httpRequestMethod) && uriString.contains(Constants.ENDPOINT_ENTITY))) {
                    return fromLinkRequestAuthenticator.getAuthenticatedAccountId(protoRequest);
                }
                final String requestUri = httpRequest.getUri().toString();
                if(requestUri.contains("/config") || requestUri.contains("/sendTranscript")){
                    return authorizationContext.getAuthorizedAccount().getAccountId();
                }
                httpRequest = updateHttpRequest(httpRequest);
                return requestAuthenticator.getAuthenticatedAccountId(httpRequest);
            }
            if (protoRequest instanceof WsEvent) {
                return handleWsEvent((WsEvent) protoRequest);
            }
            return null;
        } catch (IOException | RuntimeException cause) {
            Logger.log("#####-CHATBOT-Error while authenticating user", LocalDateTime.now());
            return null;
        }
    }

    /**
     * Handles authentication for WebSocket events.
     *
     * <p>For WebSocket connection opened events, this method:
     * <ul>
     *   <li>Extracts the HTTP request from the upgrade request</li>
     *   <li>Validates the presence of session cookies</li>
     *   <li>Delegates authentication to the bound Authentication extension</li>
     *   <li>Stores the authenticated connection in the WebSocket connection store</li>
     * </ul>
     *
     * @param wsEvent the WebSocket event to authenticate
     * @return the authenticated account ID, or {@code null} if authentication fails
     * @throws IOException if an I/O error occurs during authentication
     */
    private String handleWsEvent(WsEvent wsEvent) throws IOException {
        if (wsEvent instanceof WsConnectionOpened) {
            WsConnectionOpened upgradeRequest = (WsConnectionOpened) wsEvent;
            HttpRequest httpRequest = upgradeRequest.getHttpRequest();
            httpRequest.bufferBody();
            if (!Objects.isNull(httpRequest.getHeaders()) && !httpRequest.getHeaders().isEmpty()) {
                String cookie = httpRequest.getHeaders().get(Constants.COOKIE);
                if (Objects.isNull(cookie) || cookie.isBlank()) {
                    Logger.log("#####-CHATBOT-Cookie is not present");
                    String cookieHeader = httpRequest.getHeaders().get(Constants.CHATBOT_SESSION_ID);
                    if (Objects.isNull(cookieHeader) || cookieHeader.isBlank()) {
                        Logger.log("#####-CHATBOT-Cookie header is not present");
                        return null;
                    }
                }
            }
            httpRequest = updateHttpRequest(httpRequest);
            try {
                String accountId = requestAuthenticator.getAuthenticatedAccountId(httpRequest);
                WsConnectionOpenedHandler wsEventHandler = (WsConnectionOpenedHandler) wsEventHandlerRegistry.getWsEventHandler(wsEvent);
                return wsEventHandler.authenticate(accountId, wsEvent);
            } catch (Exception ex) {
                Logger.log("#####-CHATBOT-Error while authenticating user hence returning null", LocalDateTime.now());
                return null;
            }
        }
        return wsEventHandlerRegistry.getWsEventHandler(wsEvent).authenticate(null, wsEvent);
    }

    /**
     * Updates an HTTP request with additional headers required for authentication.
     *
     * <p>Adds the following headers to the request:
     * <ul>
     *   <li>SOURCE: Set to the JAX-RS ID for identifying the request origin</li>
     *   <li>CALLER_URI: Set to the routing URL for callback purposes</li>
     * </ul>
     *
     * @param httpRequest the HTTP request to update
     * @return a new HTTP request with the updated headers, or {@code null} if input is null
     */
    private HttpRequest updateHttpRequest(HttpRequest httpRequest) {
        if (Objects.isNull(httpRequest)) {
            return null;
        }
        Map<String, String> headers = httpRequest.getHeaders();
        if (Objects.isNull(headers)) {
            headers = new TreeMap<>();
        }
        headers.put(Constants.SOURCE, Constants.JAX_RS_ID);
        String routingURI = invoker.getRoutingInfo().getRoutingURL(HttpProtocol.PROTOCOL_NAME, RoutingInfo.Type.APPLIANCE);
        headers.put(Constants.CALLER_URI, routingURI);
        return HttpRequest.create(httpRequest.getUri(), httpRequest.getMethod(),
                headers, httpRequest.getBody());
    }

    @Override
    public boolean setServiceAuthorization(String s) {
        return requestAuthenticator.setServiceAuthorization(s);
    }

    @Override
    public Map<String, NamedField> getAttributeFields() {
        return requestAuthenticator.getAttributeFields();
    }

    @Override
    public ProtoResponse getMustAuthenticateResponse(MustAuthenticateException e, ProtoRequest protoRequest) {
        return requestAuthenticator.getMustAuthenticateResponse(e, protoRequest);
    }

    @Override
    public AuthorizationResponse getMustAuthenticateResponse(MustAuthenticateException e) {
        return requestAuthenticator.getMustAuthenticateResponse(e);
    }

    @Override
    public ProtoResponse getMustAuthorizeResponse(MustAuthorizeException e, ProtoRequest protoRequest) {
        return requestAuthenticator.getMustAuthorizeResponse(e, protoRequest);
    }

    @Override
    public AuthorizationResponse getMustAuthorizeResponse(MustAuthorizeException e) {
        return requestAuthenticator.getMustAuthorizeResponse(e);
    }
}
