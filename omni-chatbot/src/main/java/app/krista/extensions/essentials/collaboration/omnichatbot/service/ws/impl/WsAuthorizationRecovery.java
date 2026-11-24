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

import app.krista.extension.request.protos.ws.WsEvent;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.impl.WsConnectionStore;
import app.krista.extensions.essentials.collaboration.omnichatbot.store.ConnectionStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Resolves the account that owns a WebSocket connection, healing the node-local
 * authorization state after an invoker upgrade.
 *
 * <p>Root cause this addresses: the node-local {@link WsConnectionStore} (static,
 * per-classloader) is wiped when the invoker is upgraded/reloaded, while the
 * platform keeps existing WebSocket connections open. Frames arriving on a
 * connection opened before the upgrade then resolve to "unauthenticated"
 * forever — pings are still answered (masking the failure from the client) but
 * user messages are silently dropped ("NO AUTHORIZED ACCOUNT FOUND ...").
 *
 * <p>Recovery: the distributed {@link ConnectionStore} (Infinispan-backed, written
 * on WS open, survives reloads) keeps a reverse connectionId&rarr;accountId index.
 * On a local miss we consult it and, on a hit, re-populate the local store with
 * the live {@code WsConnection} carried by the event — restoring both frame
 * authentication and node-local delivery (e.g. status updates) in one step.
 */
final class WsAuthorizationRecovery {

    private static final Logger LOGGER = LoggerFactory.getLogger(WsAuthorizationRecovery.class);

    private WsAuthorizationRecovery() {
    }

    /**
     * Returns the accountId owning the event's connection: node-local lookup
     * first, then the distributed reverse index (re-populating the local store
     * on recovery). Returns {@code null} for genuinely unauthenticated
     * connections (e.g. frames before the open handshake authorized).
     */
    static String resolveAccountId(ConnectionStore connectionStore, WsEvent wsEvent) {
        String connectionId = wsEvent.getConnection().getConnectionId();
        String accountId = WsConnectionStore.getAccountIdByWsConnectionId(connectionId);
        if (accountId != null) {
            return accountId;
        }
        String recovered = connectionStore.getAccountIdByConnectionId(connectionId);
        if (recovered != null) {
            LOGGER.warn("#####-CHATBOT-Recovered WS authorization from distributed store (invoker reloaded) for accountId: {} and connectionId: {}",
                    recovered, connectionId);
            WsConnectionStore.saveConnectionAuthorization(wsEvent.getConnection(), recovered);
        }
        return recovered;
    }
}
