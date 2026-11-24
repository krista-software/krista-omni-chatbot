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

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Date;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import javax.inject.Inject;
import javax.ws.rs.*;
import javax.ws.rs.core.*;

import app.krista.extension.authorization.AuthorizationException;
import app.krista.extension.request.protos.ws.WsConnection;
import app.krista.extensions.essentials.collaboration.omnichatbot.ChatBotExtension;
import app.krista.extensions.essentials.collaboration.omnichatbot.ChatBotPool;
import app.krista.extensions.essentials.collaboration.omnichatbot.audit.AuditService;
import app.krista.extensions.essentials.collaboration.omnichatbot.concurrency.ConcurrencyManager;
import app.krista.extensions.essentials.collaboration.omnichatbot.metrics.ChatBotMetrics;
import app.krista.extensions.essentials.collaboration.omnichatbot.resource.dto.QueuedLoginResponse;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.ChatBotApiService;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.impl.WsConnectionStore;
import app.krista.ksdk.accounts.Account;
import app.krista.ksdk.accounts.ModifiableAccount;
import app.krista.ksdk.context.AuthorizationContext;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import static javax.ws.rs.core.HttpHeaders.SET_COOKIE;

@SuppressWarnings("deprecation")
@Path("/authn")
public class ChatBotAuthResource {

    private static final Logger LOGGER = LoggerFactory.getLogger(ChatBotAuthResource.class);

    private final ChatBotAuthService authService;
    private final AuthorizationContext authorizationContext;
    private final ChatBotExtension chatBotExtension;
    private final AuditService auditService;
    private final ChatBotApiService chatBotApiService;

    @Inject
    public ChatBotAuthResource(ChatBotAuthService authService, AuthorizationContext authorizationContext,
            ChatBotExtension chatBotExtension, AuditService auditService, ChatBotApiService chatBotApiService) {
        this.authService = authService;
        this.authorizationContext = authorizationContext;
        this.chatBotExtension = chatBotExtension;
        this.auditService = auditService;
        this.chatBotApiService = chatBotApiService;
    }

    /**
     * Session language used when the login endpoint folds session-creation in. The pool
     * pre-warms in "en" too; the user's real language is applied authoritatively on WS-open
     * ({@code WsConnectionOpenedHandler}, {@code ?lang=}), so this default is never user-visible.
     */
    private static final String DEFAULT_SESSION_LANGUAGE = "en";

    // extras.servedFrom values — which login path produced the session. Purely a passive label
    // (the path is already decided), surfaced so the client / load test can report the real
    // pool-vs-fresh-vs-returning split without grepping server logs.
    private static final String SERVED_FROM_POOL = "pool";
    private static final String SERVED_FROM_FRESH = "fresh";
    private static final String SERVED_FROM_RETURNING = "returning";

    /**
     * Returns {@code loginBodyJson} with its {@code inboxId} set to the real OmniChannel session
     * inbox (inbox_S_…), {@code extras.sessionReady=true}, and {@code extras.servedFrom} set to
     * the originating path. This is the single-call contract: the SPA opens the WebSocket with
     * this inbox and skips {@code POST /session}.
     */
    private static String withSessionReady(String loginBodyJson, String sessionInbox, String servedFrom) {
        JsonObject body = JsonParser.parseString(loginBodyJson).getAsJsonObject();
        body.addProperty("inboxId", sessionInbox);
        JsonObject extras = body.has("extras") && body.get("extras").isJsonObject()
                ? body.getAsJsonObject("extras")
                : new JsonObject();
        extras.addProperty("sessionReady", true);
        extras.addProperty("servedFrom", servedFrom);
        body.add("extras", extras);
        return body.toString();
    }

    @GET
    @Path("/type")
    public String getAuthType() {
        return AuthConstants.AUTHENTICATION_TYPE;
    }

    @OPTIONS
    @Path("/login")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response loginOptions(@Context HttpHeaders headers, String email) {
        return getResponseBuilderWithCORSHeaders().build();
    }

    @POST
    @Path("/login")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response login(@HeaderParam(AuthConstants.SOURCE) String source,
                          @CookieParam(AuthConstants.CHATBOT_SESSION_ID) Cookie clientSessionId,
                          @HeaderParam(AuthConstants.CALLER_URI) String callerUri,
                          Map<String, String> loginInput)
            throws AuthorizationException, URISyntaxException {

        String runtimeAccountId = authService.getRuntimeContext().getKristaAccount().getAccountId();
        Account authorizedAccount = (authorizationContext != null && authorizationContext.isAuthenticated())
                ? authorizationContext.getAuthorizedAccount() : null;
        String authorizedAccountId = authorizedAccount != null ? authorizedAccount.getAccountId() : null;

        ConcurrencyManager cm = chatBotExtension.getConcurrencyManager();
        if (cm != null && cm.isEnabled()) {
            return handleLoginWithQueue(source, clientSessionId, callerUri, loginInput,
                    runtimeAccountId, authorizedAccountId, cm);
        }

        return handleLogin(source, clientSessionId, callerUri, loginInput,
                runtimeAccountId, authorizedAccountId, null);
    }

    // ---- queue-gated login ----

    private Response handleLoginWithQueue(String source, Cookie clientSessionId,
            String callerUri, Map<String, String> loginInput,
            String runtimeAccountId, String authorizedAccountId,
            ConcurrencyManager cm) throws AuthorizationException, URISyntaxException {

        // Returning user with an active slot — they already hold a seat.
        if (authorizedAccountId != null && !runtimeAccountId.equals(authorizedAccountId)
                && !Objects.isNull(clientSessionId)) {
            AuthenticationResponse existing = authService.getAuthAccountManager()
                    .get(clientSessionId.getValue());
            boolean activeSeat = existing != null && cm.hasActiveSlot(existing.getAccountId());
            if (activeSeat) {
                cm.acquireSlot(existing.getAccountId());
                Map<String, Object> extras = existing.getExtras();
                if (extras != null) {
                    extras.remove("newSession");
                }
                auditService.recordReturningSession();
                // Single-call contract: fold the session into login so the SPA can skip
                // POST /session. getOrCreateSession revalidates/recreates a possibly-swept
                // session for this returning user and returns the live inbox_S_….
                String sessionInbox = chatBotApiService.getOrCreateSession(
                        existing.getAccountId(), DEFAULT_SESSION_LANGUAGE);
                return getResponseBuilderWithCORSHeaders()
                        .entity(withSessionReady(AuthConstants.GSON_JSON_MAPPER.toString(existing), sessionInbox, SERVED_FROM_RETURNING))
                        .build();
            }
        }

        Long queueToken = parseQueueToken(loginInput);
        QueuedLoginResponse queued = cm.checkLoginAdmission(queueToken);
        if (queued != null) {
            auditService.recordUserQueued();
            return Response.status(429)
                    .type(MediaType.APPLICATION_JSON_TYPE)
                    .header("Access-Control-Allow-Origin", "*")
                    .header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
                    .header("Access-Control-Allow-Headers", "Content-Type")
                    .header("Access-Control-Allow-Credentials", true)
                    .header("Cache-Control", "no-store")
                    .header("Retry-After", queued.getPollIntervalMs() / 1000)
                    .entity(AuthConstants.GSON_JSON_MAPPER.toString(queued))
                    .build();
        }

        // Admitted — proceed with normal login (acquireSlot called inside handleLogin)
        return handleLogin(source, clientSessionId, callerUri, loginInput,
                runtimeAccountId, authorizedAccountId, cm);
    }

    // ---- normal login (original logic, extracted) ----

    private Response handleLogin(String source, Cookie clientSessionId,
            String callerUri, Map<String, String> loginInput,
            String runtimeAccountId, String authorizedAccountId,
            ConcurrencyManager cm)
            throws AuthorizationException, URISyntaxException {

        // Returning-user fast-path
        if (authorizedAccountId != null && !runtimeAccountId.equals(authorizedAccountId)
                && !Objects.isNull(clientSessionId)) {
            AuthenticationResponse existing = authService.getAuthAccountManager()
                    .get(clientSessionId.getValue());
            if (existing == null) {
                LOGGER.error("#####-AUTHENTICATION RESPONSE IS NULL FOR CLIENT SESSION ID: {}",
                        clientSessionId.getValue());
            } else {
                if (cm != null) {
                    cm.acquireSlot(existing.getAccountId());
                }
                Map<String, Object> extras = existing.getExtras();
                if (extras != null) {
                    extras.remove("newSession");
                }
                auditService.recordReturningSession();
                // Single-call contract: fold the session into login so the SPA can skip
                // POST /session. getOrCreateSession revalidates/recreates a possibly-swept
                // session for this returning user and returns the live inbox_S_….
                String sessionInbox = chatBotApiService.getOrCreateSession(
                        existing.getAccountId(), DEFAULT_SESSION_LANGUAGE);
                return getResponseBuilderWithCORSHeaders()
                        .entity(withSessionReady(AuthConstants.GSON_JSON_MAPPER.toString(existing), sessionInbox, SERVED_FROM_RETURNING))
                        .build();
            }
        }

        // Pool check — everyone reaching here is a NEW session: both returning-user
        // fast-paths above already returned. A fresh guest login authenticates AS the
        // invoker's runtime account (authorizedAccountId == runtimeAccountId — CONFIRMED at
        // runtime), so the pool pop must NOT be gated on a runtime-vs-authorized comparison:
        // that check excluded exactly the fresh guests the pool exists to serve, which is why
        // the pool was never consumed. Attempt a pool entry unconditionally here;
        // popPoolEntryAsResponse no-ops when createPoolUsers is off or the pool is empty,
        // falling through to fresh provisioning below. The admission/queue gate
        // (checkLoginAdmission in handleLoginWithQueue) already ran, so the "Limit active
        // users" cap stays enforced — the pool pop only serves already-admitted users.
        LOGGER.info("#####-CHATBOT LOGIN pool attempt: runtimeAccountId={}, authorizedAccountId={}, createPoolUsers={}",
                runtimeAccountId, authorizedAccountId, chatBotExtension.getChatBotPool().isCreatePoolUsersEnabled());
        Response pooled = popPoolEntryAsResponse(callerUri, cm);
        if (pooled != null) {
            LOGGER.info("#####-CHATBOT LOGIN user session fetched from pool (pre-warmed entry)");
            auditService.recordNewSession();
            return pooled;
        }

        // Fresh guest provisioning
        if (!Objects.isNull(clientSessionId) && !clientSessionId.getValue().isBlank()) {
            authService.getAuthAccountManager().delete(clientSessionId.getValue());
        }
        boolean isOmni = !Objects.isNull(source) && !source.isBlank();
        String defaultRoleName = authService.getAccountProvisioner().getDefaultRoleName();
        AuthenticationResponse authenticationResponse;
        try {
            authenticationResponse = authService.provisionGuestSession(isOmni, defaultRoleName);
        } catch (RuntimeException cause) {
            // The visitor could not be given a guest account/session (provisioning / IAM
            // failed). Record the classified login failure for SigNoz, then rethrow so the
            // caller's behaviour is unchanged — this is observation only.
            ChatBotMetrics.recordChatStartFailure("guest_account_unavailable", "guest");
            throw cause;
        }
        if (authenticationResponse == null || authenticationResponse.getAccountId() == null) {
            // Provisioning returned without an account. Fail explicitly here: every line
            // below dereferences authenticationResponse, so falling through only produced
            // an opaque NPE a few statements later. Same outcome for the caller (a runtime
            // failure -> 5xx), but with a diagnosable message and the metric already recorded.
            ChatBotMetrics.recordChatStartFailure("guest_account_unavailable", "guest");
            throw new IllegalStateException(
                    "Guest provisioning returned no account; cannot establish a chatbot session");
        }
        if (cm != null) {
            cm.acquireSlot(authenticationResponse.getAccountId());
        }
        auditService.recordNewSession();
        LOGGER.info("#####-CHATBOT LOGIN new guest session created (not from pool), accountId={}",
                authenticationResponse.getAccountId());

        // Single-call contract: fold session-creation into login so the SPA can skip
        // POST /session. A fresh guest login authenticates AS the runtime account, so the
        // session must be created for the freshly-provisioned account (explicit id, NOT the
        // context account). Language "en" here; the user's real language is applied on WS-open.
        String sessionInbox = chatBotApiService.getOrCreateSession(
                authenticationResponse.getAccountId(), DEFAULT_SESSION_LANGUAGE);

        URI httpURI = authService.resolveCallerUri(callerUri);
        String cookiePath = authService.getCookiePath(httpURI);
        int maxAgeInSeconds = authService.getMaxAgeInSeconds();
        Date expiry = new Date(System.currentTimeMillis() + maxAgeInSeconds * 1000L);
        String sessionId = authenticationResponse.getClientSessionId();

        String chatbotSessionCookie = authService.createCookieString(
                AuthConstants.CHATBOT_SESSION_ID, sessionId, cookiePath + "/",
                httpURI.getHost(), maxAgeInSeconds, expiry.toString());
        String kristaContextCookie = authService.createCookieString(
                AuthConstants.X_KRISTA_CONTEXT, authService.getEncodedClientSessionId(sessionId), "/",
                httpURI.getHost(), maxAgeInSeconds, expiry.toString());

        return getResponseBuilderWithCORSHeaders()
                .header(SET_COOKIE, chatbotSessionCookie)
                .header(SET_COOKIE, kristaContextCookie)
                .header(AuthConstants.CHATBOT_SESSION_ID, sessionId)
                .entity(withSessionReady(AuthConstants.GSON_JSON_MAPPER.toString(authenticationResponse), sessionInbox, SERVED_FROM_FRESH))
                .build();
    }

    // ---- pool entry (internal, called by handleLogin) ----

    private Response popPoolEntryAsResponse(String callerUri, ConcurrencyManager cm) throws URISyntaxException {
        ChatBotPool pool = chatBotExtension.getChatBotPool();
        if (pool == null || !pool.isCreatePoolUsersEnabled()) {
            return null;
        }
        Optional<ChatBotPool.PooledAuth> entry = pool.popInline();
        if (entry.isEmpty()) {
            return null;
        }
        ChatBotPool.PooledAuth auth = entry.get();
        if (cm != null) {
            cm.acquireSlot(auth.accountId());
        }
        URI httpURI = authService.resolveCallerUri(callerUri);
        String cookiePath = authService.getCookiePath(httpURI);
        int maxAgeInSeconds = authService.getMaxAgeInSeconds();
        Date expiry = new Date(System.currentTimeMillis() + maxAgeInSeconds * 1000L);

        JsonObject loginBody = JsonParser.parseString(auth.loginBodyJson()).getAsJsonObject();
        String clientSessionId = loginBody.has("clientSessionId")
                ? loginBody.get("clientSessionId").getAsString() : null;

        // Single-call contract: return the pool's PRE-WARMED session inbox (inbox_S_…, created by
        // preWarmSession) and extras.sessionReady=true, so the SPA opens the WebSocket with it and
        // skips POST /session — free here since the session already exists. The raw pooled body
        // carries an account-derived inbox (inbox_wsContact_…, unused by the SPA) which we overwrite.
        // Back-compat: older SPAs ignore sessionReady and still call POST /session, which
        // getOrCreates the same pre-warmed session and returns this inbox.
        String entity = auth.inboxId() != null
                ? withSessionReady(auth.loginBodyJson(), auth.inboxId(), SERVED_FROM_POOL)
                : auth.loginBodyJson();

        String chatbotSessionCookie = authService.createCookieString(
                AuthConstants.CHATBOT_SESSION_ID, clientSessionId, cookiePath + "/",
                httpURI.getHost(), maxAgeInSeconds, expiry.toString());
        String kristaContextCookie = authService.createCookieString(
                AuthConstants.X_KRISTA_CONTEXT, authService.getEncodedClientSessionId(clientSessionId), "/",
                httpURI.getHost(), maxAgeInSeconds, expiry.toString());

        return getResponseBuilderWithCORSHeaders()
                .header(SET_COOKIE, chatbotSessionCookie)
                .header(SET_COOKIE, kristaContextCookie)
                .header(AuthConstants.CHATBOT_SESSION_ID, clientSessionId)
                .entity(entity)
                .build();
    }

    private static Long parseQueueToken(Map<String, String> loginInput) {
        if (loginInput == null) {
            return null;
        }
        String raw = loginInput.get("queueToken");
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return Long.parseLong(raw.trim());
        } catch (NumberFormatException cause) {
            return null;
        }
    }

    // ---- person attributes ----

    @POST
    @Path("/upsertPersonAttributes")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public void upsertPersonAttributes(@HeaderParam(AuthConstants.SOURCE) String source,
            @CookieParam(AuthConstants.CHATBOT_SESSION_ID) Cookie clientSessionId,
            @HeaderParam(AuthConstants.CHATBOT_SESSION_ID_HEADER) String clientSessionIdHeader,
            @HeaderParam(AuthConstants.CALLER_URI) String callerUri,
            Map<String, String> attributesMap) throws AuthorizationException {
        final String sessionId = getSessionId(clientSessionId, clientSessionIdHeader);
        AuthenticationResponse authResponse = authService.getAuthAccountManager().get(sessionId);
        if (authResponse == null) {
            LOGGER.error("#####-AUTHENTICATION RESPONSE IS NULL FOR SESSION ID: {}", sessionId);
            return;
        }
        String accountId = authResponse.getAccountId();
        if (attributesMap != null && !attributesMap.isEmpty()) {
            final ModifiableAccount modifiableAccount = authService.getAccountProvisioner()
                    .getAccountManager().getAccount(accountId);
            attributesMap.forEach((key, value) -> {
                if (value != null) {
                    modifiableAccount.updateAttributeValue(key, value);
                }
            });
        }
    }

    // ---- logout ----

    @POST
    @Path("/v1/logout")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response logout(@CookieParam("chatbotSessionId") Cookie chatbotSessionCookie,
            @CookieParam("X-Krista-Context") Cookie kristaContextCookie,
            @HeaderParam(AuthConstants.CALLER_URI) String callerUri,
            @HeaderParam(AuthConstants.CHATBOT_SESSION_ID_HEADER) String clientSessionIdHeader)
            throws URISyntaxException {
        final String sessionId = getSessionId(chatbotSessionCookie, clientSessionIdHeader);
        String accountId = null;
        if (sessionId != null) {
            AuthenticationResponse authResponse = authService.getAuthAccountManager().get(sessionId);
            if (authResponse != null) {
                accountId = authResponse.getAccountId();
            }
            authService.getAuthAccountManager().delete(sessionId);
        }

        // Free the concurrency seat immediately (no grace period) and close the WebSocket
        if (accountId != null) {
            ConcurrencyManager cm = chatBotExtension.getConcurrencyManager();
            if (cm != null && cm.isEnabled()) {
                cm.releaseSlot(accountId);
            }
            try {
                WsConnection ws = WsConnectionStore.getWsConnectionByAccountId(accountId);
                if (ws != null) {
                    ws.close(1000, "Logged out");
                }
            } catch (Exception cause) {
                LOGGER.warn("#####-CHATBOT LOGOUT failed to close WebSocket for accountId={}: {}",
                        accountId, cause.getMessage());
            }
            // Stamp the invoker's last-activity marker only when a live session was actually
            // ended. Logout is legitimately called more than once for the same session — the
            // session-timeout teardown calls it, and a subsequent Start Over calls it again
            // (which also acts as a retry if the first call failed). Those follow-up calls
            // resolve no session, so stamping unconditionally reported invoker activity for
            // a request that did nothing.
            auditService.recordSessionEnded("logout");
        }
        URI httpURI = authService.resolveCallerUri(callerUri);
        String cookiePath = authService.getCookiePath(httpURI);
        return getResponseBuilderWithCORSHeaders()
                .header(SET_COOKIE, authService.createExpiredCookie(
                        AuthConstants.CHATBOT_SESSION_ID, cookiePath + "/", httpURI.getHost()))
                .header(SET_COOKIE, authService.createExpiredCookie(
                        AuthConstants.X_KRISTA_CONTEXT, "/", httpURI.getHost()))
                .entity("Logout successful from guest authentication.")
                .build();
    }

    // ---- helpers ----

    private static String getSessionId(Cookie clientSessionId, String clientSessionIdHeader) {
        return clientSessionId != null ? clientSessionId.getValue() : clientSessionIdHeader;
    }

    private Response.ResponseBuilder getResponseBuilderWithCORSHeaders() {
        return Response.status(200)
                .header("Access-Control-Allow-Origin", "*")
                .header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
                .header("Access-Control-Allow-Headers", "Content-Type")
                .header("Access-Control-Allow-Credentials", true);
    }
}
