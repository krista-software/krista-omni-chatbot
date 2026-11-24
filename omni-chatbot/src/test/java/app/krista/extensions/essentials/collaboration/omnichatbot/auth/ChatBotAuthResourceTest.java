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

import app.krista.extensions.essentials.collaboration.omnichatbot.ChatBotExtension;
import app.krista.extensions.essentials.collaboration.omnichatbot.ChatBotPool;
import app.krista.extensions.essentials.collaboration.omnichatbot.audit.AuditService;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.ChatBotApiService;
import app.krista.ksdk.accounts.Account;
import app.krista.ksdk.context.AuthorizationContext;
import app.krista.ksdk.context.RuntimeContext;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import javax.ws.rs.core.Cookie;
import javax.ws.rs.core.Response;
import java.net.URI;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link ChatBotAuthResource#login} verifying the single-call session-inbox
 * contract: ALL login paths (pool / fresh / returning) fold the real OmniChannel session
 * inbox (inbox_S_…) into the login response and flag {@code extras.sessionReady=true}, so the
 * SPA can open the WebSocket with that inbox and skip {@code POST /session}.
 */
@DisplayName("ChatBotAuthResource — single-call login session-inbox emission")
class ChatBotAuthResourceTest {

    private static final String RUNTIME_ACCOUNT_ID = "wsContact_runtime";
    private static final String CALLER_URI = "https://host/extension/api/routing";
    private static final String POOLED_LOGIN_BODY =
            "{\"clientSessionId\":\"cs-1\",\"accountId\":\"wsContact_acc1\","
            + "\"inboxId\":\"inbox_wsContact_acc1\",\"extras\":{\"newSession\":true}}";

    @Mock private ChatBotAuthService authService;
    @Mock private AuthorizationContext authorizationContext;
    @Mock private ChatBotExtension chatBotExtension;
    @Mock private AuditService auditService;
    @Mock private ChatBotApiService chatBotApiService;
    @Mock private ChatBotPool chatBotPool;
    @Mock private RuntimeContext runtimeContext;
    @Mock private Account kristaAccount;
    @Mock private AccountProvisioner accountProvisioner;
    @Mock private AuthAccountManager authAccountManager;

    private ChatBotAuthResource resource;

    @BeforeEach
    void setUp() throws Exception {
        MockitoAnnotations.openMocks(this);

        when(authService.getRuntimeContext()).thenReturn(runtimeContext);
        when(runtimeContext.getKristaAccount()).thenReturn(kristaAccount);
        when(kristaAccount.getAccountId()).thenReturn(RUNTIME_ACCOUNT_ID);

        when(chatBotExtension.getConcurrencyManager()).thenReturn(null);   // concurrency OFF
        when(chatBotExtension.getChatBotPool()).thenReturn(chatBotPool);

        // Cookie-building helpers (shared by all response paths).
        when(authService.resolveCallerUri(any())).thenReturn(new URI(CALLER_URI));
        when(authService.getCookiePath(any())).thenReturn("/extension/api/routing");
        when(authService.getMaxAgeInSeconds()).thenReturn(3600);
        when(authService.getEncodedClientSessionId(any())).thenReturn("enc");
        when(authService.createCookieString(anyString(), any(), anyString(), any(), anyInt(), anyString()))
                .thenReturn("cookie");

        resource = new ChatBotAuthResource(authService, authorizationContext, chatBotExtension,
                auditService, chatBotApiService);
    }

    @Test
    @DisplayName("pooled login: emits the pre-warmed inbox_S_ + sessionReady (no getOrCreateSession)")
    void pooledLogin_emitsPrewarmedSessionInboxAndSessionReady() throws Exception {
        when(authorizationContext.isAuthenticated()).thenReturn(false);   // fresh guest -> authorizedAccountId null
        when(chatBotPool.isCreatePoolUsersEnabled()).thenReturn(true);
        when(chatBotPool.popInline()).thenReturn(Optional.of(
                new ChatBotPool.PooledAuth(POOLED_LOGIN_BODY, "wsContact_acc1", "inbox_S_prewarmed")));

        Response response = resource.login(null, null, CALLER_URI, null);

        JsonObject body = okBody(response);
        assertThat(body.get("inboxId").getAsString()).isEqualTo("inbox_S_prewarmed");
        assertThat(body.getAsJsonObject("extras").get("sessionReady").getAsBoolean()).isTrue();
        assertThat(body.getAsJsonObject("extras").get("servedFrom").getAsString()).isEqualTo("pool");
        verify(chatBotPool).popInline();
    }

    @Test
    @DisplayName("fresh login (pool off): folds getOrCreateSession for the NEW account, emits inbox_S_ + sessionReady")
    void freshLogin_foldsSessionAndEmitsSessionReady() throws Exception {
        when(authorizationContext.isAuthenticated()).thenReturn(false);
        when(chatBotPool.isCreatePoolUsersEnabled()).thenReturn(false);    // pool off -> fresh provisioning
        when(authService.getAccountProvisioner()).thenReturn(accountProvisioner);
        when(accountProvisioner.getDefaultRoleName()).thenReturn("Krista Guest User");

        Map<String, Object> extras = new HashMap<>();
        extras.put("newSession", true);
        AuthenticationResponse fresh = new AuthenticationResponse(
                "cs-fresh", "guest", null, "wsContact_fresh", RUNTIME_ACCOUNT_ID, "person-1",
                List.of("role-1"), "inbox_wsContact_fresh", true, false,
                Map.of("email", "guest@omni.com"), extras);
        when(authService.provisionGuestSession(false, "Krista Guest User")).thenReturn(fresh);
        // The session must be created for the freshly-provisioned account (NOT the runtime/context account).
        when(chatBotApiService.getOrCreateSession(eq("wsContact_fresh"), anyString())).thenReturn("inbox_S_fresh");

        Response response = resource.login(null, null, CALLER_URI, null);

        JsonObject body = okBody(response);
        assertThat(body.get("inboxId").getAsString()).isEqualTo("inbox_S_fresh");
        assertThat(body.getAsJsonObject("extras").get("sessionReady").getAsBoolean()).isTrue();
        assertThat(body.getAsJsonObject("extras").get("servedFrom").getAsString()).isEqualTo("fresh");
        verify(chatBotPool, never()).popInline();
    }

    @Test
    @DisplayName("returning login: revalidates via getOrCreateSession, emits inbox_S_ + sessionReady")
    void returningLogin_foldsSessionAndEmitsSessionReady() throws Exception {
        Account returningAccount = mock(Account.class);
        when(returningAccount.getAccountId()).thenReturn("wsContact_returning");
        when(authorizationContext.isAuthenticated()).thenReturn(true);
        when(authorizationContext.getAuthorizedAccount()).thenReturn(returningAccount);

        Map<String, Object> extras = new HashMap<>();
        extras.put("newSession", true);
        AuthenticationResponse existing = new AuthenticationResponse(
                "cs-return", "guest", null, "wsContact_returning", RUNTIME_ACCOUNT_ID, "person-2",
                List.of("role-1"), "inbox_wsContact_returning", true, false,
                Map.of("email", "guest2@omni.com"), extras);
        when(authService.getAuthAccountManager()).thenReturn(authAccountManager);
        when(authAccountManager.get("cs-return")).thenReturn(existing);
        when(chatBotApiService.getOrCreateSession(eq("wsContact_returning"), anyString()))
                .thenReturn("inbox_S_returning");

        Response response = resource.login(null, new Cookie("chatbotSessionId", "cs-return"), CALLER_URI, null);

        JsonObject body = okBody(response);
        assertThat(body.get("inboxId").getAsString()).isEqualTo("inbox_S_returning");
        assertThat(body.getAsJsonObject("extras").get("sessionReady").getAsBoolean()).isTrue();
        assertThat(body.getAsJsonObject("extras").get("servedFrom").getAsString()).isEqualTo("returning");
        verify(chatBotPool, never()).popInline();   // returning users never touch the pool
    }

    private static JsonObject okBody(Response response) {
        assertThat(response.getStatus()).isEqualTo(200);
        return JsonParser.parseString((String) response.getEntity()).getAsJsonObject();
    }
}
