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

import app.krista.extension.request.protos.ws.WsConnection;
import app.krista.extension.request.protos.ws.WsEvent;
import app.krista.extension.util.InvokerAttributeProvider;
import app.krista.extensions.essentials.collaboration.omnichatbot.audit.AuditService;
import app.krista.extensions.essentials.collaboration.omnichatbot.concurrency.ConcurrencyManager;
import app.krista.extensions.essentials.collaboration.omnichatbot.resource.dto.SessionDto;
import app.krista.extensions.essentials.collaboration.omnichatbot.store.ConnectionStore;
import app.krista.extensions.essentials.collaboration.omnichatbot.store.SessionStore;
import app.krista.extensions.util.KeyValueStore;
import app.krista.ksdk.accounts.Account;
import app.krista.ksdk.context.AuthorizationContext;
import app.krista.omni.sdk.medium.interactive.InteractiveMediumService;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.io.IOException;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the welcome-launch semantics of {@link WsConnectionOpenedHandler}.
 *
 * <p>The behaviour under test is the one-shot gate: {@code SessionDto.welcomeExecuted}
 * must flip <b>only</b> when the welcome conversation actually ran. A welcome that could
 * not run (conversation not LIVE / no role access / transient session-resolution failure —
 * the SDK collapses all of these to a {@code null} return) must leave the gate open so a
 * later connection retries, otherwise a single failure pins the session to the fallback
 * for its entire lifetime.
 *
 * <p>Also covers the deterministic fallback message id, which is what makes retrying safe:
 * repeated fallback pushes within one page session collapse client-side because the
 * frontend de-duplicates incoming messages by id.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("WsConnectionOpenedHandler — welcome launch")
class WsConnectionOpenedHandlerWelcomeTest {

    private static final String ACCOUNT_ID = "acc-welcome";
    private static final String WELCOME_NAME = "Welcome Conversation";
    // Distinctive, apostrophe-free fragment of the handler's DEFAULT_FALLBACK_MESSAGE
    // ("Sorry, we're having trouble responding right now. Please try again in a little while.").
    // We match on a fragment rather than the full string because Gson serializes with
    // html-safe encoding on, so the apostrophe in "we're" is escaped to \u0027 in the raw WS
    // frame — a full-text contains() would miss it. The frontend un-escapes it on JSON.parse,
    // so end users still see "we're".
    private static final String DEFAULT_FALLBACK = "having trouble responding right now";

    private ConnectionStore connectionStore;
    private InteractiveMediumService mediumService;
    private InvokerAttributeProvider<String> welcomeConversationProvider;
    private SessionStore sessionStore;
    private ConcurrencyManager concurrencyManager;
    private KeyValueStore keyValueStore;
    private AuditService auditService;

    private WsConnectionOpenedHandler handler;

    /** Unique per test so the static WelcomeExecutionTracker can't leak between tests. */
    private String inboxId;

    @SuppressWarnings("unchecked")
    @BeforeEach
    void setUp() {
        inboxId = "inbox_S_" + java.util.UUID.randomUUID();

        connectionStore = mock(ConnectionStore.class);
        mediumService = mock(InteractiveMediumService.class);
        welcomeConversationProvider = mock(InvokerAttributeProvider.class);
        sessionStore = mock(SessionStore.class);
        concurrencyManager = mock(ConcurrencyManager.class);
        keyValueStore = mock(KeyValueStore.class);
        auditService = mock(AuditService.class);

        when(welcomeConversationProvider.get()).thenReturn(WELCOME_NAME);
        // No uiConfigJson in the store -> readUiConfigValue falls back to its defaults,
        // so the fallback bubble carries DEFAULT_FALLBACK.
        when(keyValueStore.get(anyString())).thenReturn(null);

        handler = new WsConnectionOpenedHandler(connectionStore, mediumService,
                welcomeConversationProvider, sessionStore, concurrencyManager,
                keyValueStore, auditService);
    }

    @AfterEach
    void tearDown() {
        // Release the in-process guard so a leaked entry cannot affect other tests.
        WelcomeExecutionTracker.onConnectionClosed(inboxId);
    }

    // ---------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------

    private WsConnection newConnection() {
        WsConnection connection = mock(WsConnection.class);
        when(connection.getConnectionId()).thenReturn("conn-" + java.util.UUID.randomUUID());
        return connection;
    }

    private WsEvent eventFor(WsConnection connection) {
        WsEvent wsEvent = mock(WsEvent.class);
        when(wsEvent.getConnection()).thenReturn(connection);
        return wsEvent;
    }

    private AuthorizationContext authenticatedContext() {
        Account account = mock(Account.class);
        when(account.getAccountId()).thenReturn(ACCOUNT_ID);
        AuthorizationContext context = mock(AuthorizationContext.class);
        when(context.isAuthenticated()).thenReturn(true);
        when(context.getAuthorizedAccount()).thenReturn(account);
        return context;
    }

    private void givenSession(boolean welcomeAlreadyExecuted) {
        SessionDto sessionDto = new SessionDto(inboxId);
        sessionDto.setWelcomeExecuted(welcomeAlreadyExecuted);
        when(sessionStore.get(ACCOUNT_ID)).thenReturn(sessionDto);
    }

    /** All text frames written to the connection. */
    private List<String> sentFrames(WsConnection connection) throws IOException {
        ArgumentCaptor<String> captor = ArgumentCaptor.forClass(String.class);
        verify(connection, org.mockito.Mockito.atLeast(0)).sendTextMessage(captor.capture());
        return captor.getAllValues();
    }

    /** The NewMessages frame carrying the fallback bubble, or null when none was sent. */
    private String fallbackFrame(WsConnection connection) throws IOException {
        return sentFrames(connection).stream()
                .filter(frame -> frame.contains(DEFAULT_FALLBACK))
                .findFirst()
                .orElse(null);
    }

    private String messageIdOf(String newMessagesFrame) {
        JsonObject root = JsonParser.parseString(newMessagesFrame).getAsJsonObject();
        return root.getAsJsonObject("payload")
                .getAsJsonObject("payload")
                .getAsJsonArray("messages")
                .get(0).getAsJsonObject()
                .get("id").getAsString();
    }

    // ---------------------------------------------------------
    // Tests
    // ---------------------------------------------------------

    @Test
    @DisplayName("welcome runs -> gate is flipped and no fallback is shown")
    void welcomeSuccessFlipsGateAndShowsNoFallback() throws IOException {
        givenSession(false);
        when(mediumService.executeConversationById(eq(inboxId), isNull(), eq(WELCOME_NAME)))
                .thenReturn("conv-123");

        WsConnection connection = newConnection();
        handler.handle(authenticatedContext(), eventFor(connection));

        verify(sessionStore).put(eq(ACCOUNT_ID), argThat(SessionDto::isWelcomeExecuted));
        assertThat(fallbackFrame(connection)).isNull();
    }

    @Test
    @DisplayName("welcome unavailable (null) -> fallback shown and gate LEFT OPEN so a reconnect retries")
    void welcomeUnavailableLeavesGateOpen() throws IOException {
        givenSession(false);
        when(mediumService.executeConversationById(eq(inboxId), isNull(), eq(WELCOME_NAME)))
                .thenReturn(null);

        WsConnection connection = newConnection();
        handler.handle(authenticatedContext(), eventFor(connection));

        // The gate must NOT be persisted — this is the regression guard.
        verify(sessionStore, never()).put(anyString(), any(SessionDto.class));
        assertThat(fallbackFrame(connection)).isNotNull();
    }

    @Test
    @DisplayName("welcome throws (platform error) -> fallback shown and gate LEFT OPEN")
    void welcomePlatformErrorLeavesGateOpen() throws IOException {
        givenSession(false);
        when(mediumService.executeConversationById(eq(inboxId), isNull(), eq(WELCOME_NAME)))
                .thenThrow(new RuntimeException("boom"));

        WsConnection connection = newConnection();
        handler.handle(authenticatedContext(), eventFor(connection));

        verify(sessionStore, never()).put(anyString(), any(SessionDto.class));
        assertThat(fallbackFrame(connection)).isNotNull();
    }

    @Test
    @DisplayName("a failed welcome is retried on the next connection (DRAFT -> LIVE recovery)")
    void failedWelcomeIsRetriedOnNextConnection() throws IOException {
        givenSession(false);
        when(mediumService.executeConversationById(eq(inboxId), isNull(), eq(WELCOME_NAME)))
                .thenReturn(null)        // first connect: conversation still DRAFT
                .thenReturn("conv-123"); // admin publishes it; second connect succeeds

        WsConnection first = newConnection();
        handler.handle(authenticatedContext(), eventFor(first));
        // Browser refresh / reconnect: the close handler releases the in-process guard.
        WelcomeExecutionTracker.onConnectionClosed(inboxId);
        WsConnection second = newConnection();
        handler.handle(authenticatedContext(), eventFor(second));

        verify(mediumService, times(2))
                .executeConversationById(eq(inboxId), isNull(), eq(WELCOME_NAME));
        // Only the successful second attempt flips the gate.
        verify(sessionStore, times(1)).put(eq(ACCOUNT_ID), argThat(SessionDto::isWelcomeExecuted));
        assertThat(fallbackFrame(first)).isNotNull();
        assertThat(fallbackFrame(second)).isNull();
    }

    @Test
    @DisplayName("already-executed session -> welcome is not re-run and no fallback is shown")
    void alreadyExecutedSessionSkipsWelcome() throws IOException {
        givenSession(true);

        WsConnection connection = newConnection();
        handler.handle(authenticatedContext(), eventFor(connection));

        verify(mediumService, never()).executeConversationById(anyString(), any(), anyString());
        verify(sessionStore, never()).put(anyString(), any(SessionDto.class));
        assertThat(fallbackFrame(connection)).isNull();
    }

    @Test
    @DisplayName("fallback message id is deterministic per session so the client de-duplicates repeats")
    void fallbackMessageIdIsDeterministicPerSession() throws IOException {
        givenSession(false);
        when(mediumService.executeConversationById(eq(inboxId), isNull(), eq(WELCOME_NAME)))
                .thenReturn(null);

        WsConnection first = newConnection();
        handler.handle(authenticatedContext(), eventFor(first));
        WelcomeExecutionTracker.onConnectionClosed(inboxId);
        WsConnection second = newConnection();
        handler.handle(authenticatedContext(), eventFor(second));

        String firstId = messageIdOf(fallbackFrame(first));
        String secondId = messageIdOf(fallbackFrame(second));
        assertThat(firstId).isEqualTo(secondId);
    }
}
