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

import app.krista.extension.executor.Invoker;
import app.krista.extensions.essentials.collaboration.omnichatbot.auth.AuthAccountManager;
import app.krista.extensions.essentials.collaboration.omnichatbot.auth.AuthConstants;
import app.krista.extensions.essentials.collaboration.omnichatbot.auth.AuthenticationResponse;
import app.krista.extensions.essentials.collaboration.omnichatbot.auth.ChatBotAuthService;
import app.krista.extensions.essentials.collaboration.omnichatbot.auth.RoleUtils;
import app.krista.extensions.essentials.collaboration.omnichatbot.store.PoolStore;
import app.krista.extensions.essentials.collaboration.omnichatbot.store.SessionStore;
import app.krista.extensions.util.KeyValueStore;
import app.krista.ksdk.accounts.AccountManager;
import app.krista.ksdk.accounts.AccountProvider;
import app.krista.ksdk.accounts.ModifiableAccount;
import app.krista.ksdk.authorization.Role;
import app.krista.ksdk.authorization.RoleManager;
import app.krista.ksdk.workspace.Workspace;
import app.krista.omni.sdk.medium.interactive.InteractiveMediumService;
import com.google.gson.Gson;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Unit tests for the two targeted fixes applied to {@link ChatBotPool} as part
 * of KR-21024:
 *
 * <ol>
 *   <li><b>Null-role guard</b>: when {@link RoleUtils#resolveRoleId} returns
 *       {@code null} (e.g. a typo in the invoker attribute), the role-change task
 *       must abort immediately without touching any pool entry. The previous code
 *       passed {@code null} into {@code List.of(null)}, which then NPE'd inside
 *       {@code refreshCachedRoles} and was caught per entry — silently draining
 *       the entire pool for an invalid role name.</li>
 *   <li><b>Pool-store persistence</b>: after a successful in-place role update,
 *       the updated body JSON must be written back to {@link PoolStore} so that a
 *       JVM restart or a subsequent {@code popInline} serves the current role.
 *       Previously only the in-memory {@link AuthAccountManager} cache was updated.</li>
 * </ol>
 */
@ExtendWith(MockitoExtension.class)
// Lenient: the shared fixture builds the full pool (constructor + reflection-injected
// pool state) and stubs are conditionally exercised — the null-role abort path
// deliberately never reaches the pool-entry stubs, which strict stubbing would flag.
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("ChatBotPool role-change fixes (KR-21024)")
class ChatBotPoolTest {

    private static final Gson GSON = new Gson();
    private static final String POOL_KEY = "pool-key-001";
    private static final String ACCOUNT_ID = "acc-pool-001";
    private static final String SESSION_ID = "sess-001";
    private static final String INBOX_ID = "inbox-pool-001";
    private static final String NEW_ROLE = "NewRole";
    private static final String NEW_ROLE_ID = "role-id-new";

    // -----------------------------------------------------------------------
    // Mocked dependencies
    // -----------------------------------------------------------------------

    private PoolStore poolStore;
    private ChatBotAuthService authService;
    private SessionStore sessionStore;
    private AccountProvider accountProvider;
    private AccountManager accountManager;
    private AuthAccountManager authAccountManager;
    private KeyValueStore keyValueStore;
    private Invoker invoker;
    private RoleManager roleManager;
    private Workspace workspace;

    private ChatBotPool pool;
    private MockedStatic<RoleUtils> staticRoleUtils;
    private MockedStatic<InteractiveMediumService> staticMediumService;

    @BeforeEach
    void setUp() throws Exception {
        poolStore = mock(PoolStore.class);
        authService = mock(ChatBotAuthService.class);
        sessionStore = mock(SessionStore.class);
        accountProvider = mock(AccountProvider.class);
        accountManager = mock(AccountManager.class);
        authAccountManager = mock(AuthAccountManager.class);
        keyValueStore = mock(KeyValueStore.class);
        invoker = mock(Invoker.class);
        roleManager = mock(RoleManager.class);
        workspace = mock(Workspace.class);

        // Stub recoverFromStore() — called in the constructor
        when(poolStore.getKeys()).thenReturn(Set.of());
        when(keyValueStore.get(anyString())).thenReturn(null);

        // Stub invoker attributes (changeDefaultRoleAsync reads the target role from here)
        when(invoker.getInvokerId()).thenReturn("INV_test");
        when(invoker.getAttributes()).thenReturn(Map.of(AuthConstants.DEFAULT_ROLE_KEY, NEW_ROLE));

        // The constructor calls InteractiveMediumService.getInstance(), which needs a
        // live RequestContext (absent in a unit test) — stub it during construction.
        staticMediumService = mockStatic(InteractiveMediumService.class);
        staticMediumService.when(InteractiveMediumService::getInstance)
                .thenReturn(mock(InteractiveMediumService.class));

        pool = new ChatBotPool(poolStore, authService, sessionStore,
                accountProvider, accountManager, roleManager,
                authAccountManager, workspace, invoker, keyValueStore);

        // The role change normally runs on a background single-thread executor.
        // Replace it with a SAME-THREAD executor so the work runs on the test
        // thread — Mockito's mockStatic(...) is thread-local, so a stubbed static
        // (RoleUtils) only applies on the thread that registered it.
        Field execField = ChatBotPool.class.getDeclaredField("roleChangeExecutor");
        execField.setAccessible(true);
        execField.set(pool, directExecutor());

        staticRoleUtils = mockStatic(RoleUtils.class);
    }

    /** ExecutorService that runs every submitted task synchronously on the caller's thread. */
    private static ExecutorService directExecutor() {
        return new java.util.concurrent.AbstractExecutorService() {
            private volatile boolean shutdown = false;

            @Override
            public void execute(Runnable command) {
                command.run();
            }

            @Override
            public void shutdown() {
                shutdown = true;
            }

            @Override
            public java.util.List<Runnable> shutdownNow() {
                shutdown = true;
                return java.util.List.of();
            }

            @Override
            public boolean isShutdown() {
                return shutdown;
            }

            @Override
            public boolean isTerminated() {
                return shutdown;
            }

            @Override
            public boolean awaitTermination(long timeout, TimeUnit unit) {
                return true;
            }
        };
    }

    @AfterEach
    void tearDown() {
        staticRoleUtils.close();
        staticMediumService.close();
        pool.shutdown();
    }

    // -----------------------------------------------------------------------
    // Helper: wait for the single-threaded roleChangeExecutor to drain
    // -----------------------------------------------------------------------

    private void awaitRoleChangeCompletion() throws Exception {
        Field field = ChatBotPool.class.getDeclaredField("roleChangeExecutor");
        field.setAccessible(true);
        ExecutorService exec = (ExecutorService) field.get(pool);
        CountDownLatch latch = new CountDownLatch(1);
        exec.submit(latch::countDown);
        assertThat(latch.await(10, TimeUnit.SECONDS)).isTrue();
    }

    // -----------------------------------------------------------------------
    // Helper: inject a pool key + backing store entry via reflection
    // -----------------------------------------------------------------------

    private void injectPoolEntry(String key, String accountId, String sessionId, String inboxId) throws Exception {
        AuthenticationResponse cachedAuth = new AuthenticationResponse(
                sessionId, "Guest", null, accountId,
                null, null, List.of("old-role-id"), inboxId,
                false, false, null, null);
        String bodyJson = GSON.toJson(cachedAuth);

        // Build the StoredEntry JSON — matches the private inner class structure
        String storedEntryJson = "{\"body\":" + GSON.toJson(bodyJson)
                + ",\"accountId\":\"" + accountId + "\""
                + ",\"inboxId\":\"" + inboxId + "\"}";
        when(poolStore.get(key)).thenReturn(storedEntryJson);

        // Add the key to the availableKeys deque
        Field dequeField = ChatBotPool.class.getDeclaredField("availableKeys");
        dequeField.setAccessible(true);
        @SuppressWarnings("unchecked")
        ConcurrentLinkedDeque<String> deque = (ConcurrentLinkedDeque<String>) dequeField.get(pool);
        deque.add(key);

        // Stub auth account manager to return the cached auth for session lookup
        when(authAccountManager.get(sessionId)).thenReturn(cachedAuth);
    }

    // -----------------------------------------------------------------------
    // Test 1: null-role guard
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("null resolveRoleId: role change aborts, poolStore.put() is never called")
    void nullRoleId_abortsRoleChange() throws Exception {
        staticRoleUtils.when(() -> RoleUtils.resolveRoleId(any(), anyString(), anyBoolean()))
                .thenReturn(null);

        pool.changeDefaultRoleAsync();
        awaitRoleChangeCompletion();

        verify(poolStore, never()).put(anyString(), anyString());
        verify(accountManager, never()).getAccount(anyString());
    }

    @Test
    @DisplayName("null resolveRoleId: existing pool entries are NOT removed/dropped")
    void nullRoleId_doesNotDropPoolEntries() throws Exception {
        injectPoolEntry(POOL_KEY, ACCOUNT_ID, SESSION_ID, INBOX_ID);
        staticRoleUtils.when(() -> RoleUtils.resolveRoleId(any(), anyString(), anyBoolean()))
                .thenReturn(null);

        pool.changeDefaultRoleAsync();
        awaitRoleChangeCompletion();

        verify(poolStore, never()).delete(anyString());
    }

    // -----------------------------------------------------------------------
    // Test 2: pool-store persistence
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("valid role change: poolStore.put() is called with the pool key to persist updated body")
    void validRoleChange_persistsUpdatedBodyToPoolStore() throws Exception {
        injectPoolEntry(POOL_KEY, ACCOUNT_ID, SESSION_ID, INBOX_ID);

        Role newRole = mockRole(NEW_ROLE_ID);
        ModifiableAccount account = mock(ModifiableAccount.class);
        when(accountManager.getAccount(ACCOUNT_ID)).thenReturn(account);
        when(account.getRoles()).thenReturn(Set.of(newRole));

        staticRoleUtils.when(() -> RoleUtils.resolveRoleId(any(), anyString(), anyBoolean()))
                .thenReturn(NEW_ROLE_ID);

        pool.changeDefaultRoleAsync();
        awaitRoleChangeCompletion();

        ArgumentCaptor<String> keyCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> valueCaptor = ArgumentCaptor.forClass(String.class);
        verify(poolStore, atLeastOnce()).put(keyCaptor.capture(), valueCaptor.capture());

        assertThat(keyCaptor.getAllValues()).contains(POOL_KEY);
        // The persisted JSON must contain the correct accountId
        String persistedJson = valueCaptor.getAllValues().stream()
                .filter(v -> v.contains(ACCOUNT_ID))
                .findFirst()
                .orElse("");
        assertThat(persistedJson).contains(ACCOUNT_ID);
    }

    @Test
    @DisplayName("valid role change: authAccountManager.put() updates in-memory cache with new role")
    void validRoleChange_updatesInMemoryCache() throws Exception {
        injectPoolEntry(POOL_KEY, ACCOUNT_ID, SESSION_ID, INBOX_ID);

        Role newRole = mockRole(NEW_ROLE_ID);
        ModifiableAccount account = mock(ModifiableAccount.class);
        when(accountManager.getAccount(ACCOUNT_ID)).thenReturn(account);
        when(account.getRoles()).thenReturn(Set.of(newRole));

        staticRoleUtils.when(() -> RoleUtils.resolveRoleId(any(), anyString(), anyBoolean()))
                .thenReturn(NEW_ROLE_ID);

        pool.changeDefaultRoleAsync();
        awaitRoleChangeCompletion();

        verify(authAccountManager, atLeastOnce()).put(eq(SESSION_ID), any(AuthenticationResponse.class));
    }

    private static Role mockRole(String roleId) {
        Role role = mock(Role.class);
        when(role.getRoleId()).thenReturn(roleId);
        return role;
    }
}
