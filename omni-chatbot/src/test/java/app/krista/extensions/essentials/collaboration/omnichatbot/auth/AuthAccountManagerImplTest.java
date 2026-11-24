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

import app.krista.extensions.util.KeyValueStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration tests for {@link AuthAccountManagerImpl} using a real in-memory
 * {@link KeyValueStore} implementation.
 *
 * <p>No mocks are used here.  The store is a plain {@code HashMap}-backed
 * implementation that satisfies the full {@link KeyValueStore} contract.  This
 * gives us confidence that JSON serialisation/deserialisation round-trips work
 * correctly and that the session lifecycle (put → get → delete) is wired
 * properly in the implementation.
 *
 * <p>Ported from guest-authentication's {@code AccountManagerImplTest} (Mockito-based)
 * and re-located to omni-chatbot which now owns the migrated code.
 */
@DisplayName("AuthAccountManagerImpl Integration Tests")
class AuthAccountManagerImplTest {

    /**
     * Simple HashMap-backed KeyValueStore for use in tests.
     *
     * <p>No mock framework needed – this is a real implementation of the interface
     * that exercises the same code path as the Infinispan-backed store used in production.
     */
    private static final class InMemoryKeyValueStore implements KeyValueStore {

        private final Map<String, Object> store = new HashMap<>();

        @Override
        public Object get(String key) {
            return store.get(key);
        }

        @Override
        public void remove(String key) {
            store.remove(key);
        }

        @Override
        public boolean contains(String key) {
            return store.containsKey(key);
        }

        @Override
        public void put(String key, Object value) {
            store.put(key, value);
        }

        @Override
        public boolean supports(Class<?> typeClass) {
            return true;
        }

        @Override
        public Set<String> getKeys() {
            return new HashSet<>(store.keySet());
        }

        @Override
        public Iterator<Map.Entry<String, Object>> iterator() {
            return store.entrySet().iterator();
        }

        public int size() {
            return store.size();
        }
    }

    private InMemoryKeyValueStore keyValueStore;
    private AuthAccountManagerImpl accountManager;

    @BeforeEach
    void setUp() {
        keyValueStore = new InMemoryKeyValueStore();
        accountManager = new AuthAccountManagerImpl(keyValueStore);
    }

    // -------------------------------------------------------------------------
    // helpers
    // -------------------------------------------------------------------------

    private AuthenticationResponse buildResponse(String sessionId, String accountId) {
        return new AuthenticationResponse(
                sessionId, "Test User", "avatar.png", accountId,
                "krista-" + accountId, "person-" + accountId,
                List.of("role1"), "inbox-001",
                false, false,
                Map.of("email", "test@example.com"),
                Map.of());
    }

    // -------------------------------------------------------------------------
    // put
    // -------------------------------------------------------------------------

    @Nested
    @DisplayName("put")
    class Put {

        @Test
        @DisplayName("Should store a JSON-serialised AuthenticationResponse under the session key")
        void shouldStoreSerializedResponse() {
            // Given
            String sessionId = "session-put-001";
            AuthenticationResponse response = buildResponse(sessionId, "account-001");

            // When
            accountManager.put(sessionId, response);

            // Then – raw value in the store is a JSON string (not the object itself)
            Object stored = keyValueStore.get(sessionId);
            assertNotNull(stored, "A value must be stored for the given session ID");
            assertInstanceOf(String.class, stored, "Stored value must be a JSON string");
            String json = (String) stored;
            assertTrue(json.contains("account-001"), "JSON must contain the account ID");
            assertTrue(json.contains("session-put-001"), "JSON must contain the session ID");
        }

        @Test
        @DisplayName("Should overwrite an existing entry when put is called twice with the same session ID")
        void shouldOverwriteExistingEntry() {
            // Given
            String sessionId = "session-overwrite";
            accountManager.put(sessionId, buildResponse(sessionId, "old-account"));

            // When
            AuthenticationResponse updated = buildResponse(sessionId, "new-account");
            accountManager.put(sessionId, updated);

            // Then
            String stored = (String) keyValueStore.get(sessionId);
            assertNotNull(stored);
            assertTrue(stored.contains("new-account"), "Store must reflect the updated account ID");
            assertFalse(stored.contains("old-account"), "Old account ID must no longer be present");
        }

        @Test
        @DisplayName("Should store multiple sessions independently")
        void shouldStoreMultipleSessionsIndependently() {
            // When
            accountManager.put("s1", buildResponse("s1", "acc-1"));
            accountManager.put("s2", buildResponse("s2", "acc-2"));

            // Then
            assertEquals(2, keyValueStore.size(), "Both sessions must be stored");
            assertTrue(keyValueStore.contains("s1"));
            assertTrue(keyValueStore.contains("s2"));
        }

        @Test
        @DisplayName("Should store response with empty session ID")
        void shouldStoreWithEmptySessionId() {
            // Given
            AuthenticationResponse response = buildResponse("", "account-empty");

            // When
            accountManager.put("", response);

            // Then
            assertNotNull(keyValueStore.get(""), "Empty-key entry must be stored");
        }
    }

    // -------------------------------------------------------------------------
    // get
    // -------------------------------------------------------------------------

    @Nested
    @DisplayName("get")
    class Get {

        @Test
        @DisplayName("Should round-trip AuthenticationResponse through JSON serialisation")
        void shouldRoundTripThroughJson() {
            // Given
            String sessionId = "session-get-001";
            AuthenticationResponse original = buildResponse(sessionId, "account-round-trip");
            accountManager.put(sessionId, original);

            // When
            AuthenticationResponse retrieved = accountManager.get(sessionId);

            // Then
            assertNotNull(retrieved, "get() must return a non-null response for a known session");
            assertEquals(original.getAccountId(), retrieved.getAccountId(),
                    "Account ID must survive JSON round-trip");
            assertEquals(original.getClientSessionId(), retrieved.getClientSessionId(),
                    "Session ID must survive JSON round-trip");
            assertEquals(original.getName(), retrieved.getName(),
                    "Name must survive JSON round-trip");
            assertEquals(original.getInboxId(), retrieved.getInboxId(),
                    "Inbox ID must survive JSON round-trip");
        }

        @Test
        @DisplayName("Should return null for a session ID that was never stored")
        void shouldReturnNullForUnknownSession() {
            // When
            AuthenticationResponse response = accountManager.get("non-existent");

            // Then
            assertNull(response, "get() must return null when the session does not exist");
        }

        @Test
        @DisplayName("Should return null after the session has been deleted")
        void shouldReturnNullAfterDeletion() {
            // Given
            String sessionId = "session-deleted";
            accountManager.put(sessionId, buildResponse(sessionId, "account-del"));
            accountManager.delete(sessionId);

            // When
            AuthenticationResponse response = accountManager.get(sessionId);

            // Then
            assertNull(response, "get() must return null after the session was deleted");
        }

        @Test
        @DisplayName("Should deserialise admin and applianceManager boolean flags correctly")
        void shouldDeserializeBooleanFlags() {
            // Given
            String sessionId = "session-flags";
            AuthenticationResponse original = new AuthenticationResponse(
                    sessionId, "Admin User", "avatar.png", "admin-account",
                    "krista-admin", "person-admin",
                    List.of("admin"), "inbox-admin",
                    true, true,
                    Map.of("email", "admin@example.com"),
                    Map.of());
            accountManager.put(sessionId, original);

            // When
            AuthenticationResponse retrieved = accountManager.get(sessionId);

            // Then
            assertNotNull(retrieved);
            assertTrue(retrieved.isWorkspaceAdmin(), "isWorkspaceAdmin flag must round-trip as true");
            assertTrue(retrieved.isApplianceManager(), "isApplianceManager flag must round-trip as true");
        }
    }

    // -------------------------------------------------------------------------
    // delete
    // -------------------------------------------------------------------------

    @Nested
    @DisplayName("delete")
    class Delete {

        @Test
        @DisplayName("Should remove the entry from the store")
        void shouldRemoveEntry() {
            // Given
            String sessionId = "session-to-delete";
            accountManager.put(sessionId, buildResponse(sessionId, "account-delete"));
            assertTrue(keyValueStore.contains(sessionId), "Precondition: session must exist before delete");

            // When
            accountManager.delete(sessionId);

            // Then
            assertFalse(keyValueStore.contains(sessionId), "Session must no longer be present after delete");
        }

        @Test
        @DisplayName("Should not throw when deleting a session that does not exist")
        void shouldNotThrowForMissingSession() {
            assertDoesNotThrow(() -> accountManager.delete("never-stored"),
                    "Deleting a non-existent session must not throw");
        }

        @Test
        @DisplayName("Should only delete the targeted session, leaving others intact")
        void shouldOnlyDeleteTargetedSession() {
            // Given
            accountManager.put("keep-me", buildResponse("keep-me", "acc-keep"));
            accountManager.put("delete-me", buildResponse("delete-me", "acc-delete"));

            // When
            accountManager.delete("delete-me");

            // Then
            assertFalse(keyValueStore.contains("delete-me"), "Deleted session must be gone");
            assertTrue(keyValueStore.contains("keep-me"), "Untouched session must remain");
        }
    }
}
