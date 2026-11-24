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
import app.krista.extension.request.protos.ws.WsResponseWriter;
import app.krista.extension.request.protos.ws.WsTextMessageReceived;
import app.krista.extensions.essentials.collaboration.omnichatbot.audit.AuditService;
import app.krista.extensions.essentials.collaboration.omnichatbot.concurrency.ConcurrencyManager;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.impl.WsConnectionStore;
import app.krista.extensions.essentials.collaboration.omnichatbot.store.ConnectionStore;
import app.krista.ksdk.accounts.Account;
import app.krista.ksdk.context.AuthorizationContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.StringReader;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link WsConnectionPingHandler}.
 *
 * <p>Covers the two behaviour paths added/changed for KR-21024:
 * <ol>
 *   <li><b>Authenticated ping</b> — pong is written back to the client and the
 *       concurrency slot is refreshed; connection is NOT closed.</li>
 *   <li><b>Unauthenticated ping</b> — connection is closed with 1012 "service
 *       restart" (deliberately NOT in the frontend's {@code STOP_RECONNECT_CODES})
 *       so the client auto-reconnects and re-authenticates; no pong is sent and the
 *       concurrency manager is NOT invoked.</li>
 * </ol>
 *
 * <p>The {@code authenticate()} path is also covered: it must delegate to
 * {@link WsAuthorizationRecovery#resolveAccountId}, i.e. local lookup first,
 * distributed reverse index on a local miss.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("WsConnectionPingHandler")
class WsConnectionPingHandlerTest {

    private static final String CONNECTION_ID = "ping-conn-1";
    private static final String ACCOUNT_ID = "acc-ping";

    /** Valid JSON ping payload that the handler can parse without error. */
    private static final String PING_PAYLOAD =
            "{\"signal\":\"ping\",\"payload\":{\"reference\":\"ref-1\"}}";

    private ConcurrencyManager concurrencyManager;
    private ConnectionStore connectionStore;
    private AuditService auditService;
    private WsConnectionPingHandler handler;

    @BeforeEach
    void setUp() {
        concurrencyManager = mock(ConcurrencyManager.class);
        connectionStore = mock(ConnectionStore.class);
        auditService = mock(AuditService.class);
        handler = new WsConnectionPingHandler(concurrencyManager, connectionStore, auditService);
    }

    // ---------------------------------------------------------
    // Helper factories
    // ---------------------------------------------------------

    private WsTextMessageReceived buildPingEvent(String payload) {
        WsConnection connection = mock(WsConnection.class);
        lenient().when(connection.getConnectionId()).thenReturn(CONNECTION_ID);
        WsResponseWriter writer = new WsResponseWriter(connection);
        return new WsTextMessageReceived(new StringReader(payload), writer);
    }

    private AuthorizationContext authenticated(String accountId) {
        AuthorizationContext ctx = mock(AuthorizationContext.class);
        when(ctx.isAuthenticated()).thenReturn(true);
        Account account = mock(Account.class);
        when(account.getAccountId()).thenReturn(accountId);
        when(ctx.getAuthorizedAccount()).thenReturn(account);
        return ctx;
    }

    private AuthorizationContext unauthenticated() {
        AuthorizationContext ctx = mock(AuthorizationContext.class);
        when(ctx.isAuthenticated()).thenReturn(false);
        return ctx;
    }

    // ---------------------------------------------------------
    // handle() — authenticated path
    // ---------------------------------------------------------

    @Test
    @DisplayName("authenticated ping: pong is written to the connection")
    void authenticatedPing_pongIsWritten() throws Exception {
        WsTextMessageReceived event = buildPingEvent(PING_PAYLOAD);

        handler.handle(authenticated(ACCOUNT_ID), event);

        // the pong payload is written as a text message on the underlying connection
        verify(event.getConnection(), atLeastOnce()).sendTextMessage(anyString());
    }

    @Test
    @DisplayName("authenticated ping: connection is NOT closed")
    void authenticatedPing_connectionNotClosed() throws Exception {
        WsTextMessageReceived event = buildPingEvent(PING_PAYLOAD);

        handler.handle(authenticated(ACCOUNT_ID), event);

        verify(event.getConnection(), never()).close(anyInt());
        verify(event.getConnection(), never()).close(anyInt(), anyString());
    }

    @Test
    @DisplayName("authenticated ping: concurrency slot heartbeat is refreshed")
    void authenticatedPing_concurrencySlotRefreshed() throws Exception {
        WsTextMessageReceived event = buildPingEvent(PING_PAYLOAD);

        handler.handle(authenticated(ACCOUNT_ID), event);

        verify(concurrencyManager).onWsPing(ACCOUNT_ID);
    }

    // ---------------------------------------------------------
    // handle() — unauthenticated path
    // ---------------------------------------------------------

    // Note: handle() decides authenticated-ness from the AuthorizationContext
    // (isAuthenticated()), NOT from the connection stores — so these tests do not
    // stub WsConnectionStore/ConnectionStore. Store-based resolution is exercised
    // via authenticate() below.

    @Test
    @DisplayName("unauthenticated ping: connection closed with 1012 (triggers client re-handshake)")
    void unauthenticatedPing_closedWith1012() throws Exception {
        WsTextMessageReceived event = buildPingEvent(PING_PAYLOAD);

        handler.handle(unauthenticated(), event);

        verify(event.getConnection()).close(1012, "Re-authentication required");
    }

    @Test
    @DisplayName("unauthenticated ping: no pong is sent")
    void unauthenticatedPing_noPongSent() throws Exception {
        WsTextMessageReceived event = buildPingEvent(PING_PAYLOAD);

        handler.handle(unauthenticated(), event);

        verify(event.getConnection(), never()).sendTextMessage(anyString());
    }

    @Test
    @DisplayName("unauthenticated ping: concurrency manager is NOT invoked")
    void unauthenticatedPing_concurrencyManagerNotInvoked() throws Exception {
        WsTextMessageReceived event = buildPingEvent(PING_PAYLOAD);

        handler.handle(unauthenticated(), event);

        verifyNoInteractions(concurrencyManager);
    }

    // ---------------------------------------------------------
    // authenticate() — delegates to WsAuthorizationRecovery
    // ---------------------------------------------------------

    @Test
    @DisplayName("authenticate(): local hit returns accountId without touching ConnectionStore")
    void authenticate_localHit() throws Exception {
        WsTextMessageReceived event = buildPingEvent("{}");

        try (MockedStatic<WsConnectionStore> staticStore = mockStatic(WsConnectionStore.class)) {
            staticStore.when(() -> WsConnectionStore.getAccountIdByWsConnectionId(CONNECTION_ID))
                    .thenReturn(ACCOUNT_ID);

            String result = handler.authenticate(null, event);

            assertThat(result).isEqualTo(ACCOUNT_ID);
            verifyNoInteractions(connectionStore);
        }
    }

    @Test
    @DisplayName("authenticate(): local miss falls back to distributed reverse index")
    void authenticate_localMissFallsBackToDistributed() throws Exception {
        WsTextMessageReceived event = buildPingEvent("{}");
        when(connectionStore.getAccountIdByConnectionId(CONNECTION_ID)).thenReturn(ACCOUNT_ID);

        try (MockedStatic<WsConnectionStore> staticStore = mockStatic(WsConnectionStore.class)) {
            staticStore.when(() -> WsConnectionStore.getAccountIdByWsConnectionId(CONNECTION_ID))
                    .thenReturn(null);

            String result = handler.authenticate(null, event);

            assertThat(result).isEqualTo(ACCOUNT_ID);
            verify(connectionStore).getAccountIdByConnectionId(CONNECTION_ID);
        }
    }

    @Test
    @DisplayName("authenticate(): both miss returns null")
    void authenticate_bothMissReturnsNull() throws Exception {
        WsTextMessageReceived event = buildPingEvent("{}");
        when(connectionStore.getAccountIdByConnectionId(CONNECTION_ID)).thenReturn(null);

        try (MockedStatic<WsConnectionStore> staticStore = mockStatic(WsConnectionStore.class)) {
            staticStore.when(() -> WsConnectionStore.getAccountIdByWsConnectionId(CONNECTION_ID))
                    .thenReturn(null);

            String result = handler.authenticate(null, event);

            assertThat(result).isNull();
        }
    }
}
