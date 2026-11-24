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
import app.krista.extensions.essentials.collaboration.omnichatbot.service.impl.WsConnectionStore;
import app.krista.extensions.essentials.collaboration.omnichatbot.store.ConnectionStore;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.StringReader;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link WsAuthorizationRecovery}.
 *
 * <p>This class is package-private so the test lives in the same package.
 *
 * <p>The tests exercise the three-outcome resolution path added for KR-21024:
 * <ol>
 *   <li>Local hit — node-local {@link WsConnectionStore} has the mapping;
 *       distributed store is NOT consulted.</li>
 *   <li>Local miss + distributed hit — distributed reverse index contains the
 *       mapping; local store is re-populated so the recovery is instant and
 *       self-healing.</li>
 *   <li>Both miss — connection is genuinely unauthenticated; {@code null} returned.</li>
 * </ol>
 *
 * <p>{@link WsConnectionStore} uses static methods and a static
 * {@code ConcurrentHashMap} that IS a real JVM-wide singleton, not a dependency
 * we can swap. We therefore use {@link MockedStatic} (Mockito 5 inline mode) to
 * isolate each test without touching real static state.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("WsAuthorizationRecovery")
class WsAuthorizationRecoveryTest {

    private static final String CONNECTION_ID = "conn-test-abc";
    private static final String ACCOUNT_ID = "acc-xyz";

    /** Builds a minimal WsEvent with the given connectionId. */
    private static WsTextMessageReceived buildEvent(String connectionId) {
        WsConnection wsConnection = mock(WsConnection.class);
        when(wsConnection.getConnectionId()).thenReturn(connectionId);
        WsResponseWriter writer = new WsResponseWriter(wsConnection);
        return new WsTextMessageReceived(new StringReader("{}"), writer);
    }

    @Test
    @DisplayName("local hit: returns accountId from WsConnectionStore, does NOT touch ConnectionStore")
    void localHit_returnsLocalAccountId() {
        ConnectionStore distStore = mock(ConnectionStore.class);
        WsTextMessageReceived event = buildEvent(CONNECTION_ID);

        try (MockedStatic<WsConnectionStore> staticStore = mockStatic(WsConnectionStore.class)) {
            staticStore.when(() -> WsConnectionStore.getAccountIdByWsConnectionId(CONNECTION_ID))
                    .thenReturn(ACCOUNT_ID);

            String result = WsAuthorizationRecovery.resolveAccountId(distStore, event);

            assertThat(result).isEqualTo(ACCOUNT_ID);
            // distributed store must NOT be consulted on a local hit
            verifyNoInteractions(distStore);
        }
    }

    @Test
    @DisplayName("local miss + distributed hit: returns recovered accountId and re-populates local store")
    void localMiss_distributedHit_recoversAndRepopulatesLocal() {
        ConnectionStore distStore = mock(ConnectionStore.class);
        when(distStore.getAccountIdByConnectionId(CONNECTION_ID)).thenReturn(ACCOUNT_ID);
        WsTextMessageReceived event = buildEvent(CONNECTION_ID);

        try (MockedStatic<WsConnectionStore> staticStore = mockStatic(WsConnectionStore.class)) {
            staticStore.when(() -> WsConnectionStore.getAccountIdByWsConnectionId(CONNECTION_ID))
                    .thenReturn(null);

            String result = WsAuthorizationRecovery.resolveAccountId(distStore, event);

            assertThat(result).isEqualTo(ACCOUNT_ID);
            // local store must be re-populated with the live WsConnection from the event
            staticStore.verify(() -> WsConnectionStore.saveConnectionAuthorization(
                    event.getConnection(), ACCOUNT_ID));
        }
    }

    @Test
    @DisplayName("both miss: returns null and does NOT attempt to save to local store")
    void bothMiss_returnsNull_noLocalSave() {
        ConnectionStore distStore = mock(ConnectionStore.class);
        when(distStore.getAccountIdByConnectionId(CONNECTION_ID)).thenReturn(null);
        WsTextMessageReceived event = buildEvent(CONNECTION_ID);

        try (MockedStatic<WsConnectionStore> staticStore = mockStatic(WsConnectionStore.class)) {
            staticStore.when(() -> WsConnectionStore.getAccountIdByWsConnectionId(CONNECTION_ID))
                    .thenReturn(null);

            String result = WsAuthorizationRecovery.resolveAccountId(distStore, event);

            assertThat(result).isNull();
            // saveConnectionAuthorization must NOT be called when there's nothing to recover
            staticStore.verify(() -> WsConnectionStore.saveConnectionAuthorization(any(), any()), never());
        }
    }

    @Test
    @DisplayName("local miss + distributed hit: distributed store is queried via reverse index")
    void localMiss_usesReverseIndex() {
        ConnectionStore distStore = mock(ConnectionStore.class);
        when(distStore.getAccountIdByConnectionId(CONNECTION_ID)).thenReturn(ACCOUNT_ID);
        WsTextMessageReceived event = buildEvent(CONNECTION_ID);

        try (MockedStatic<WsConnectionStore> staticStore = mockStatic(WsConnectionStore.class)) {
            staticStore.when(() -> WsConnectionStore.getAccountIdByWsConnectionId(CONNECTION_ID))
                    .thenReturn(null);

            WsAuthorizationRecovery.resolveAccountId(distStore, event);

            // verify that the distributed store was queried by connectionId (reverse index)
            verify(distStore).getAccountIdByConnectionId(CONNECTION_ID);
            // and not by accountId or any other method
            verify(distStore, never()).get(any());
        }
    }
}
