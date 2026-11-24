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

package app.krista.extensions.essentials.collaboration.omnichatbot.store;

import app.krista.extensions.essentials.collaboration.omnichatbot.concurrency.InMemoryKeyValueStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for {@link ConnectionStore} covering the key-prefix isolation and
 * reverse-index invariants added for KR-21024.
 *
 * <p>Root cause this guards against: the per-invoker {@link app.krista.extensions.util.KeyValueStore}
 * is SHARED with other consumers (notably the SDK {@code AccountStore} which writes
 * {@code store.put(accountId, "a_"+userIdentifier)}). Using the raw {@code accountId}
 * as the key let that write silently clobber the stored connectionId, so a subsequent
 * notification was published with a bogus connection id (e.g. {@code a_wsContact_...})
 * and the platform dropped it. The prefix fix and these tests guard against regression.
 *
 * <p>Uses {@link InMemoryKeyValueStore} — the same real (non-mock) test substrate
 * used by the concurrency tests — so the store logic runs against the same interface
 * contract as Infinispan in production.
 */
@DisplayName("ConnectionStore — key-prefix isolation + reverse-index invariants")
class ConnectionStoreTest {

    private InMemoryKeyValueStore backingStore;
    private ConnectionStore store;

    @BeforeEach
    void setUp() {
        backingStore = new InMemoryKeyValueStore();
        store = new ConnectionStore(backingStore);
    }

    // ---------------------------------------------------------
    // put() — forward key uses prefix
    // ---------------------------------------------------------

    @Test
    @DisplayName("put(): forward key uses chatbot-connection- prefix, not raw accountId")
    void put_usesForwardPrefix() {
        store.put("acc-1", "conn-1");
        // raw key must NOT exist (regression against the clobber bug)
        assertThat(backingStore.get("acc-1")).isNull();
        // prefixed forward key must exist with the connection id as the value
        assertThat(backingStore.get("chatbot-connection-acc-1")).isEqualTo("conn-1");
    }

    @Test
    @DisplayName("put(): reverse key chatbot-connection-rev-<connId> stores accountId")
    void put_storesReverseEntry() {
        store.put("acc-1", "conn-1");
        assertThat(backingStore.get("chatbot-connection-rev-conn-1")).isEqualTo("acc-1");
    }

    @Test
    @DisplayName("put(): reassigning a new connectionId removes the stale reverse entry")
    void put_removesStalReverseEntryOnConnectionChange() {
        store.put("acc-1", "conn-old");
        store.put("acc-1", "conn-new");

        // stale reverse entry for the old connection must be gone
        assertThat(backingStore.get("chatbot-connection-rev-conn-old")).isNull();
        // new reverse entry must be present
        assertThat(backingStore.get("chatbot-connection-rev-conn-new")).isEqualTo("acc-1");
    }

    @Test
    @DisplayName("put(): same connectionId twice does NOT blow away the reverse entry")
    void put_sameConnectionIdIdempotent() {
        store.put("acc-1", "conn-1");
        store.put("acc-1", "conn-1"); // same conn, the stale-removal guard must not fire
        assertThat(backingStore.get("chatbot-connection-rev-conn-1")).isEqualTo("acc-1");
    }

    // ---------------------------------------------------------
    // get() — null-safe behaviour
    // ---------------------------------------------------------

    @Test
    @DisplayName("get(): returns null (not the string 'null') for an unknown accountId")
    void get_returnsNullNotStringNull() {
        assertThat(store.get("unknown-acc")).isNull();
    }

    @Test
    @DisplayName("get(): returns the stored connectionId for a known accountId")
    void get_returnsConnectionId() {
        store.put("acc-1", "conn-1");
        assertThat(store.get("acc-1")).isEqualTo("conn-1");
    }

    // ---------------------------------------------------------
    // getAccountIdByConnectionId() — reverse lookup
    // ---------------------------------------------------------

    @Test
    @DisplayName("getAccountIdByConnectionId(): returns accountId for a known connectionId")
    void getAccountIdByConnectionId_returnsAccountId() {
        store.put("acc-1", "conn-1");
        assertThat(store.getAccountIdByConnectionId("conn-1")).isEqualTo("acc-1");
    }

    @Test
    @DisplayName("getAccountIdByConnectionId(): returns null for an unknown connectionId")
    void getAccountIdByConnectionId_returnsNullForUnknown() {
        assertThat(store.getAccountIdByConnectionId("no-such-conn")).isNull();
    }

    // ---------------------------------------------------------
    // delete() — removes both directions
    // ---------------------------------------------------------

    @Test
    @DisplayName("delete(): removes both the forward and reverse entries for the account")
    void delete_removesBothEntries() {
        store.put("acc-1", "conn-1");
        store.delete("acc-1");

        assertThat(backingStore.get("chatbot-connection-acc-1")).isNull();
        assertThat(backingStore.get("chatbot-connection-rev-conn-1")).isNull();
        assertThat(store.get("acc-1")).isNull();
        assertThat(store.getAccountIdByConnectionId("conn-1")).isNull();
    }

    @Test
    @DisplayName("delete(): non-existent accountId is a no-op (no exception)")
    void delete_nonExistentIsNoOp() {
        store.delete("acc-doesnt-exist"); // must not throw
    }

    // ---------------------------------------------------------
    // deleteAll() — prefix-scoped, does not wipe unrelated keys
    // ---------------------------------------------------------

    @Test
    @DisplayName("deleteAll(): removes all chatbot-connection-* keys (both forward and reverse)")
    void deleteAll_removesOwnEntries() {
        store.put("acc-1", "conn-1");
        store.put("acc-2", "conn-2");

        store.deleteAll();

        assertThat(store.get("acc-1")).isNull();
        assertThat(store.getAccountIdByConnectionId("conn-1")).isNull();
        assertThat(store.get("acc-2")).isNull();
        assertThat(store.getAccountIdByConnectionId("conn-2")).isNull();
    }

    @Test
    @DisplayName("deleteAll(): leaves unrelated keys in the shared KeyValueStore untouched")
    void deleteAll_scopedToPrefixDoesNotWipeOtherKeys() {
        store.put("acc-1", "conn-1");
        // simulate SDK AccountStore writing under the same KeyValueStore with a raw accountId key
        backingStore.put("acc-1", "a_wsContact_abc123");         // SDK-style: no chatbot- prefix
        backingStore.put("chatbot-session-acc-1", "session-x");   // different prefix

        store.deleteAll();

        // SDK key and session key must survive
        assertThat(backingStore.get("acc-1")).isEqualTo("a_wsContact_abc123");
        assertThat(backingStore.get("chatbot-session-acc-1")).isEqualTo("session-x");
        // own entry is gone
        assertThat(store.get("acc-1")).isNull();
    }
}
