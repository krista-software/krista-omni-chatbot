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
import app.krista.ksdk.accounts.Account;
import app.krista.extension.request.ProtoRequest;
import app.krista.extension.request.ProtoResponse;
import app.krista.extension.request.RoutingInfo;
import app.krista.extension.request.protos.http.HttpProtocol;
import app.krista.extension.request.protos.http.HttpRequest;
import app.krista.extension.request.protos.ws.WsConnectionOpened;
import app.krista.extension.request.protos.ws.WsConnectionClosed;
import app.krista.extension.request.protos.ws.WsConnectionUpgradeRequest;
import app.krista.extension.request.protos.ws.WsEvent;
import app.krista.extensions.essentials.collaboration.omnichatbot.auth.AuthConstants;
import app.krista.extensions.essentials.collaboration.omnichatbot.auth.GuestRequestAuthenticator;
import app.krista.extensions.essentials.collaboration.omnichatbot.contants.Constants;
import app.krista.extensions.essentials.collaboration.omnichatbot.metrics.ChatBotMetrics;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.ws.WsEventHandlerRegistry;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.ws.impl.WsConnectionOpenedHandler;
import app.krista.ksdk.context.AuthorizationContext;
import app.krista.model.field.NamedField;
import app.krista.omni.sdk.complex_fields.impl.FromLinkRequestAuthenticator;
import org.jvnet.hk2.annotations.Contract;
import org.jvnet.hk2.annotations.Service;

import javax.inject.Inject;
import javax.ws.rs.HttpMethod;
import java.io.IOException;
import java.util.*;

@Service
@Contract
public class ChatBotAuthenticator implements RequestAuthenticator {
    private final RequestAuthenticator requestAuthenticator;
    private final AuthorizationContext authorizationContext;
    private final WsEventHandlerRegistry wsEventHandlerRegistry;
    private final Invoker invoker;

    @Inject
    public ChatBotAuthenticator(GuestRequestAuthenticator guestRequestAuthenticator,
                                AuthorizationContext authorizationContext,
                                WsEventHandlerRegistry wsEventHandlerRegistry, Invoker invoker) {
        this.requestAuthenticator = guestRequestAuthenticator;
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
     *   <li>Public static-asset and bootstrap paths
     *       (/config, /preview-config, /sendTranscript, /static/, /ui/, /docs/, /integration):
     *       Skips the bound Authentication invoker roundtrip and returns the already authorized account ID.</li>
     * </ul>
     *
     * @param protoRequest the protocol request to authenticate
     * @return the authenticated account ID, or {@code null} if authentication fails
     */
    @Override
    public String getAuthenticatedAccountId(ProtoRequest protoRequest) {
        try {
            if (protoRequest instanceof HttpRequest httpRequest) {
                httpRequest.bufferBody();
                String httpRequestMethod = httpRequest.getMethod();
                String uriString = httpRequest.getUri().toString();
                String requestPath = httpRequest.getUri().getPath();
                FromLinkRequestAuthenticator fromLinkRequestAuthenticator = new FromLinkRequestAuthenticator();
                if ((HttpMethod.POST.equalsIgnoreCase(httpRequestMethod) && uriString.contains(Constants.ENDPOINT_ENTITY))) {
                    return fromLinkRequestAuthenticator.getAuthenticatedAccountId(protoRequest);
                }
                if (isStaticOrPublicPath(requestPath)) {
                    if (authorizationContext != null && authorizationContext.isAuthenticated()) {
                        Account authorizedAccount = authorizationContext.getAuthorizedAccount();
                        if (authorizedAccount != null) {
                            return authorizedAccount.getAccountId();
                        }
                    }
                    return null;
                }
                httpRequest = updateHttpRequest(httpRequest);
                String httpAccountId = requestAuthenticator.getAuthenticatedAccountId(httpRequest);
                ChatBotMetrics.recordAuthAttempt(httpAccountId != null ? "success" : "failure", "http");
                return httpAccountId;
            }
            if (protoRequest instanceof WsEvent) {
                String wsAccountId = handleWsEvent((WsEvent) protoRequest);
                // Only count the connection-OPEN as an auth attempt — that is the genuine
                // login moment. Other WS events (text messages, etc.) merely re-resolve the
                // account from the connection id; counting those inflates auth attempts and
                // produces benign "failure" noise when the per-node connection map misses.
                if (protoRequest instanceof WsConnectionOpened) {
                    ChatBotMetrics.recordAuthAttempt(wsAccountId != null ? "success" : "failure", "ws");
                }
                return wsAccountId;
            }
            return null;
        } catch (IOException | RuntimeException cause) {
            ChatBotMetrics.recordAuthAttempt("failure", protoRequest instanceof WsEvent ? "ws" : "http");
            ChatBotMetrics.recordError("ChatBotAuthenticator", cause);
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
        if (wsEvent instanceof WsConnectionOpened upgradeRequest) {
            HttpRequest httpRequest = upgradeRequest.getHttpRequest();
            httpRequest.bufferBody();
            if (!Objects.isNull(httpRequest.getHeaders()) && !httpRequest.getHeaders().isEmpty()) {
                String cookie = httpRequest.getHeaders().get(Constants.COOKIE);
                if (Objects.isNull(cookie) || cookie.isBlank()) {
                    String cookieHeader = httpRequest.getHeaders().get(Constants.CHATBOT_SESSION_ID);
                    if (Objects.isNull(cookieHeader) || cookieHeader.isBlank()) {
                        // Browsers cannot set custom headers on a WS upgrade, and the
                        // session cookie is third-party (blockable) when the chatbot is
                        // embedded in a customer site — the client therefore also carries
                        // the session id as a ?clientSessionId query param, which
                        // GuestRequestAuthenticator already resolves. Only reject when
                        // that is absent too.
                        String querySessionId = httpRequest.getQueryParameters()
                                .getFirst(AuthConstants.CLIENT_SESSION_ID_QUERY_PARAM);
                        if (Objects.isNull(querySessionId) || querySessionId.isBlank()) {
                            return null;
                        }
                    }
                }
            }
            httpRequest = updateHttpRequest(httpRequest);
            try {
                String accountId = requestAuthenticator.getAuthenticatedAccountId(httpRequest);
                WsConnectionOpenedHandler wsEventHandler = (WsConnectionOpenedHandler) wsEventHandlerRegistry.getWsEventHandler(wsEvent);
                return wsEventHandler.authenticate(accountId, wsEvent);
            } catch (Exception ex) {
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
    /**
     * Returns {@code true} when {@code path} addresses an asset or endpoint that
     * does not require the bound Authentication invoker round-trip — the chatbot
     * UI bundle, docs, the integration page, and the inert {@code /config} +
     * {@code /sendTranscript} endpoints which only ever return data already
     * scoped to {@link AuthorizationContext}.
     *
     * <p>Matches against the URI {@code path} only (never the query string), so a
     * URL like {@code /api/anything?ref=/ui/x} cannot bypass the bound
     * authenticator just because its query contains a public-path substring.
     */
    private static boolean isStaticOrPublicPath(String path) {
        if (path == null) {
            return false;
        }
        return path.endsWith("/config")
                // Preview-mode config (Integration Settings live preview): identical
                // inert payload to /config, just uncached — same public treatment.
                || path.endsWith("/preview-config")
                || path.endsWith("/sendTranscript")
                || path.contains("/static/")
                || path.contains("/ui/")
                || path.contains("/docs/")
                || path.endsWith("/integration")
                // Audit tab endpoints (read-only, served from the admin integration page).
                || path.contains("/audit/");
    }

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
