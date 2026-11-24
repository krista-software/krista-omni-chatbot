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

package app.krista.extensions.essentials.collaboration.omnichatbot.auth;

import java.util.*;
import javax.inject.Inject;
import javax.ws.rs.core.MultivaluedMap;

import app.krista.extension.authorization.MustAuthenticateException;
import app.krista.extension.authorization.MustAuthorizeException;
import app.krista.extension.authorization.RequestAuthenticator;
import app.krista.extension.request.ProtoRequest;
import app.krista.extension.request.ProtoResponse;
import app.krista.extension.request.protos.http.HttpRequest;
import app.krista.ksdk.accounts.Account;
import app.krista.ksdk.accounts.AccountProvider;
import app.krista.ksdk.authentication.SessionManager;
import app.krista.ksdk.context.AuthorizationContext;
import app.krista.model.field.NamedField;
import org.jvnet.hk2.annotations.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Authenticates incoming chatbot requests by resolving the clientSessionId from a cookie,
 * header, or query parameter and looking up the corresponding account via SessionManager.
 *
 * <p>Ported from guest-authentication's GuestAuthenticationRequestAuthenticator so the chatbot
 * no longer needs to inject @Named("Authentication") Invoker — chatbot now owns its auth
 * end-to-end.
 */
@SuppressWarnings("deprecation")
@Service
public class GuestRequestAuthenticator implements RequestAuthenticator {

    private static final Logger LOGGER = LoggerFactory.getLogger(GuestRequestAuthenticator.class);

    private final AuthorizationContext authorizationContext;
    private final SessionManager sessionManager;
    private final AccountProvider accountProvider;
    private final AuthAccountManager authAccountManager;

    @Inject
    public GuestRequestAuthenticator(AuthorizationContext authorizationContext, SessionManager sessionManager,
            AccountProvider accountProvider, AuthAccountManager authAccountManager) {
        this.authorizationContext = authorizationContext;
        this.sessionManager = sessionManager;
        this.accountProvider = accountProvider;
        this.authAccountManager = authAccountManager;
    }

    @Override
    public String getScheme() {
        return null;
    }

    @Override
    public Set<String> getSupportedProtocols() {
        return null;
    }

    @Override
    public String getAuthenticatedAccountId(ProtoRequest protoRequest) {
        try {
            HttpRequest httpRequest = (HttpRequest) protoRequest;
            if (Objects.equals("/authn/upsertPersonAttributes", httpRequest.getUri().getPath())) {
                if (authorizationContext != null && authorizationContext.isAuthenticated()) {
                    Account authorizedAccount = authorizationContext.getAuthorizedAccount();
                    if (authorizedAccount != null) {
                        return authorizedAccount.getAccountId();
                    }
                }
                return null;
            }

            httpRequest.bufferBody();
            boolean isLoginRequest = Objects.equals("/authn/login", httpRequest.getUri().getPath());
            String cookie = httpRequest.getHeader(AuthConstants.COOKIE);
            String clientSessionId = getCookie(cookie, AuthConstants.CHATBOT_SESSION_ID);
            if (clientSessionId == null) {
                clientSessionId = getClientSessionIdFromHeaderOrQueryParams(httpRequest);
            }
            if (!Objects.isNull(clientSessionId)) {
                SessionResolution resolution = resolveAccountIdFromSession(clientSessionId);
                String authenticatedAccountId = resolution.accountId();
                if (!Objects.isNull(authenticatedAccountId)) {
                    // Non-login (hot-path) cache hit: trust the cached mapping. The pool
                    // sweep validates both session + account and drops invalidated entries,
                    // so we skip the extra accountProvider.getAccount round-trip.
                    if (resolution.fromCache() && !isLoginRequest) {
                        return authenticatedAccountId;
                    }
                    // /authn/login mints identity, so it must NOT authenticate as an account
                    // that no longer exists (a stale session whose account was deleted but
                    // whose cache entry has not yet been swept). Validate the account here;
                    // on the login path, ANY validation failure drops the stale cache entry
                    // and falls through to anonymous so login provisions a fresh guest
                    // instead of erroring. Non-login requests keep the original strict
                    // behaviour (only NoSuchElementException is tolerated; cache misses only).
                    try {
                        accountProvider.getAccount(authenticatedAccountId);
                        return authenticatedAccountId;
                    } catch (NoSuchElementException cause) {
                        LOGGER.error("No such account Id exist: {} with exception: {}",
                                authenticatedAccountId, cause);
                        if (isLoginRequest) {
                            authAccountManager.delete(clientSessionId);
                        }
                    } catch (Exception cause) {
                        if (!isLoginRequest) {
                            throw cause;
                        }
                        // Transient/unknown failure — NOT proof the account is gone. Do NOT delete
                        // the session. Trust the resolved id so a returning user keeps their session
                        // and history through an infra blip. A genuinely deleted account throwing a
                        // non-NoSuchElement error is a rare double-fault the pool sweep will catch.
                        LOGGER.error("Account validation failed transiently on login for accountId={}; "
                                + "proceeding with existing session", authenticatedAccountId, cause);
                        return authenticatedAccountId;
                    }
                }
            }
            return handleLoginRequest(httpRequest);
        } catch (Exception cause) {
            throw new IllegalStateException("Failed to authenticate : Reason: " + cause.getMessage(), cause);
        }
    }

    /**
     * Resolves sessionId → accountId without hitting the appliance when we can. Every
     * session we provision (pool entry or live login) is written to AuthAccountManager,
     * which is backed by KeyValueStore. A local lookup avoids the KSDK round-trip on the
     * hot path (WS open, every authenticated HTTP request). The pool sweep periodically
     * validates both the session and the account for every cache entry it owns, dropping
     * invalidated ones, so a cache hit means the entry was recently confirmed valid by
     * the sweep — the caller can skip the accountProvider.getAccount check too.
     *
     * <p>Falls back to the KSDK SessionManager for sessions not in our local cache —
     * e.g. provisioned by some other code path or after a KVS eviction. For cache
     * misses the caller still runs accountProvider.getAccount as a safety net.
     */
    private SessionResolution resolveAccountIdFromSession(String clientSessionId) {
        AuthenticationResponse cached = authAccountManager.get(clientSessionId);
        if (cached != null && cached.getAccountId() != null) {
            return new SessionResolution(cached.getAccountId(), true);
        }
        return new SessionResolution(sessionManager.lookupAccountId(clientSessionId), false);
    }

    private record SessionResolution(String accountId, boolean fromCache) {
    }

    private static String getClientSessionIdFromHeaderOrQueryParams(HttpRequest httpRequest) {
        String clientSessionId = httpRequest.getHeader(AuthConstants.CHATBOT_SESSION_ID_HEADER);
        if (Objects.isNull(clientSessionId)) {
            MultivaluedMap<String, String> queryParameters = httpRequest.getQueryParameters();
            if (!queryParameters.isEmpty()) {
                List<String> queryParamSessionId = queryParameters.get(AuthConstants.CLIENT_SESSION_ID_QUERY_PARAM);
                clientSessionId = (Objects.isNull(queryParamSessionId) || queryParamSessionId.isEmpty()) ? null
                        : queryParamSessionId.get(0);
            }
        }
        return clientSessionId;
    }

    private String getCookie(String cookie, String key) {
        if (!Objects.isNull(cookie)) {
            String[] cookies = cookie.split(";");
            for (String c : cookies) {
                if (c.trim().startsWith(key)) {
                    return c.split("=")[1];
                }
            }
        }
        return null;
    }

    @Override
    public boolean setServiceAuthorization(String s) {
        return false;
    }

    @Override
    public Map<String, NamedField> getAttributeFields() {
        return null;
    }

    @Override
    public ProtoResponse getMustAuthenticateResponse(MustAuthenticateException e, ProtoRequest protoRequest) {
        return null;
    }

    @Override
    public AuthorizationResponse getMustAuthenticateResponse(MustAuthenticateException e) {
        return null;
    }

    @Override
    public ProtoResponse getMustAuthorizeResponse(MustAuthorizeException e, ProtoRequest protoRequest) {
        return null;
    }

    @Override
    public AuthorizationResponse getMustAuthorizeResponse(MustAuthorizeException e) {
        return null;
    }

    private String handleLoginRequest(HttpRequest httpRequest) {
        if (Objects.equals("/authn/login", httpRequest.getUri().getPath())) {
            if (authorizationContext != null && authorizationContext.isAuthenticated()) {
                Account authorizedAccount = authorizationContext.getAuthorizedAccount();
                if (authorizedAccount != null) {
                    return authorizedAccount.getAccountId();
                }
            }
        }
        return null;
    }

}
