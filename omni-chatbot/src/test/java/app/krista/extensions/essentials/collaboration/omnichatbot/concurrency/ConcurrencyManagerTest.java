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

package app.krista.extensions.essentials.collaboration.omnichatbot.concurrency;

import app.krista.extension.executor.Invoker;
import app.krista.extensions.essentials.collaboration.omnichatbot.contants.Constants;
import app.krista.extensions.essentials.collaboration.omnichatbot.resource.dto.QueuedLoginResponse;
import app.krista.extensions.util.KeyValueStore;
import org.junit.jupiter.api.Test;

import java.util.HashMap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ConcurrencyManagerTest {

    private static final String ENABLED_CONFIG =
            "{\"concurrencyControlEnabled\":true,\"maxConcurrentUsers\":2,\"idleDisconnectSeconds\":600}";

    private Invoker mockInvoker() {
        Invoker invoker = mock(Invoker.class);
        when(invoker.getInvokerId()).thenReturn("inv");
        when(invoker.getAttributes()).thenReturn(new HashMap<>());
        return invoker;
    }

    private SlotStore slotStore;
    private QueueStore queueStore;

    private ConcurrencyManager enabledManager(KeyValueStore kv) {
        kv.put(Constants.UI_CONFIG_JSON, ENABLED_CONFIG);
        Invoker invoker = mockInvoker();
        ConcurrencyConfig config = new ConcurrencyConfig(kv);
        slotStore = new SlotStore(kv);
        queueStore = new QueueStore(kv);
        WaitTimeEstimator estimator = new WaitTimeEstimator(kv);
        return new ConcurrencyManager(slotStore, queueStore, config, estimator, new NoOpTelemetryMetrics(), invoker);
    }

    @Test
    void flagOffAdmitsImmediatelyAndHooksAreNoOps() {
        KeyValueStore kv = new InMemoryKeyValueStore();
        Invoker invoker = mockInvoker();
        ConcurrencyConfig config = new ConcurrencyConfig(kv);
        SlotStore slots = new SlotStore(kv);
        QueueStore queue = new QueueStore(kv);
        ConcurrencyManager manager = new ConcurrencyManager(slots, queue, config,
                new WaitTimeEstimator(kv), new NoOpTelemetryMetrics(), invoker);

        assertThat(manager.checkLoginAdmission(null)).isNull();
        manager.onWsOpened("acc-a");
        assertThat(slots.activeSlotCount()).isZero();
        manager.onWsClosed("acc-a");
        assertThat(queue.depth()).isZero();
    }

    @Test
    void admitsUpToCapThenQueues() {
        ConcurrencyManager manager = enabledManager(new InMemoryKeyValueStore());

        // First two users: admitted (null response) — reservation created in map
        assertThat(manager.checkLoginAdmission(null)).isNull();
        manager.acquireSlot("acc-a");
        manager.onWsOpened("acc-a");
        assertThat(manager.checkLoginAdmission(null)).isNull();
        manager.acquireSlot("acc-b");
        manager.onWsOpened("acc-b");
        assertThat(slotStore.activeSlotCount()).isEqualTo(2);

        // Third user: queued
        QueuedLoginResponse third = manager.checkLoginAdmission(null);
        assertThat(third).isNotNull();
        assertThat(third.getCode()).isEqualTo(QueuedLoginResponse.CODE_MAX_LIMIT_REACHED);
        assertThat(third.getQueuePosition()).isEqualTo(1);
    }

    @Test
    void queueHeadAdmittedOnPollAfterSlotFreed() {
        ConcurrencyManager manager = enabledManager(new InMemoryKeyValueStore());
        assertThat(manager.checkLoginAdmission(null)).isNull();
        manager.acquireSlot("acc-a");
        manager.onWsOpened("acc-a");
        assertThat(manager.checkLoginAdmission(null)).isNull();
        manager.acquireSlot("acc-b");
        manager.onWsOpened("acc-b");

        // Third user queued — get their token
        QueuedLoginResponse queued = manager.checkLoginAdmission(null);
        assertThat(queued).isNotNull();
        long token = queued.getQueueToken();

        // acc-a logs out — seat freed immediately
        manager.releaseSlot("acc-a");

        // Queued user polls with their token — should be admitted now
        assertThat(manager.checkLoginAdmission(token)).isNull();
        manager.acquireSlot("acc-c");
    }

    @Test
    void multipleTabsConsumeOneSlot() {
        ConcurrencyManager manager = enabledManager(new InMemoryKeyValueStore());
        assertThat(manager.checkLoginAdmission(null)).isNull();
        manager.acquireSlot("acc-a");
        manager.onWsOpened("acc-a"); // tab 1
        manager.onWsOpened("acc-a"); // tab 2 (same account)
        assertThat(slotStore.activeSlotCount()).isEqualTo(1);

        // Closing tabs does not release the seat — seat stays occupied from login
        manager.onWsClosed("acc-a"); // tab 1 closes
        assertThat(slotStore.hasSlot("acc-a")).isTrue();
        manager.onWsClosed("acc-a"); // tab 2 closes
        assertThat(slotStore.hasSlot("acc-a")).isTrue(); // seat still occupied
        assertThat(slotStore.activeSlotCount()).isEqualTo(1);

        // Reaper frees it after heartbeat goes stale
        forceExpireSlot(slotStore, "acc-a");
        manager.reapForTest();
        assertThat(slotStore.hasSlot("acc-a")).isFalse();
        assertThat(slotStore.activeSlotCount()).isEqualTo(0);
    }

    @Test
    void walkInQueuesWhenQueueIsNonEmptyEvenIfRoomExists() {
        ConcurrencyManager manager = enabledManager(new InMemoryKeyValueStore());
        assertThat(manager.checkLoginAdmission(null)).isNull();
        manager.acquireSlot("acc-a");
        manager.onWsOpened("acc-a"); // 1 of 2 used

        // Manually enqueue someone to simulate a waiting user (earlier timestamp = ahead)
        queueStore.enqueue("existing-token", System.currentTimeMillis() - 5000);

        // Walk-in must queue behind, not jump
        QueuedLoginResponse walkIn = manager.checkLoginAdmission(null);
        assertThat(walkIn).isNotNull();
        assertThat(walkIn.getQueuePosition()).isEqualTo(2);
    }

    @Test
    void failsOpenWhenStoreThrows() {
        KeyValueStore throwingStore = new InMemoryKeyValueStore() {
            @Override
            public java.util.Set<String> getKeys() {
                throw new RuntimeException("store down");
            }
        };
        ConcurrencyManager manager = enabledManager(throwingStore);

        // Capacity check scans getKeys() and throws -> must fail open (return null = admitted)
        assertThat(manager.checkLoginAdmission(null)).isNull();
    }

    @Test
    void hasActiveSlotReturnsTrueUntilLogoutOrReaper() {
        ConcurrencyManager manager = enabledManager(new InMemoryKeyValueStore());
        assertThat(manager.checkLoginAdmission(null)).isNull();
        manager.acquireSlot("acc-a");
        manager.onWsOpened("acc-a");
        assertThat(manager.hasActiveSlot("acc-a")).isTrue();

        // WS close does NOT release the seat
        manager.onWsClosed("acc-a");
        assertThat(manager.hasActiveSlot("acc-a")).isTrue();

        // Explicit logout releases the seat
        manager.releaseSlot("acc-a");
        assertThat(manager.hasActiveSlot("acc-a")).isFalse();
    }

    @Test
    void reaperReclaimsStaleSlotAfterBrowserClose() {
        ConcurrencyManager manager = enabledManager(new InMemoryKeyValueStore());
        assertThat(manager.checkLoginAdmission(null)).isNull();
        manager.acquireSlot("acc-a");
        manager.onWsOpened("acc-a");
        manager.onWsClosed("acc-a"); // browser closed — heartbeat stops

        // Slot still active before reaper
        assertThat(manager.hasActiveSlot("acc-a")).isTrue();

        // After staleness, reaper frees it
        forceExpireSlot(slotStore, "acc-a");
        manager.reapForTest();
        assertThat(manager.hasActiveSlot("acc-a")).isFalse();
        assertThat(slotStore.activeSlotCount()).isEqualTo(0);
    }

    @Test
    void seatOccupiedAtLoginPreventsOverAdmission() {
        ConcurrencyManager manager = enabledManager(new InMemoryKeyValueStore());

        // First user admitted and seat occupied at login
        assertThat(manager.checkLoginAdmission(null)).isNull();
        manager.acquireSlot("acc-a");
        assertThat(slotStore.activeSlotCount()).isEqualTo(1);

        // Second user admitted and seat occupied
        assertThat(manager.checkLoginAdmission(null)).isNull();
        manager.acquireSlot("acc-b");
        assertThat(slotStore.activeSlotCount()).isEqualTo(2);

        // Third user queued — map is full
        QueuedLoginResponse third = manager.checkLoginAdmission(null);
        assertThat(third).isNotNull();

        // WS opens later — count stays 2
        manager.onWsOpened("acc-a");
        manager.onWsOpened("acc-b");
        assertThat(slotStore.activeSlotCount()).isEqualTo(2);
    }

    @Test
    void pendingAdmissionsPreventsOverAdmission() {
        ConcurrencyManager manager = enabledManager(new InMemoryKeyValueStore());

        // Both users admitted but acquireSlot NOT called yet (simulates the race window)
        assertThat(manager.checkLoginAdmission(null)).isNull();
        assertThat(manager.checkLoginAdmission(null)).isNull();

        // Third user must be queued — pending admissions counted toward capacity
        QueuedLoginResponse third = manager.checkLoginAdmission(null);
        assertThat(third).isNotNull();

        // Now acquireSlot runs for both admitted users
        manager.acquireSlot("acc-a");
        manager.acquireSlot("acc-b");
        assertThat(slotStore.activeSlotCount()).isEqualTo(2);
    }

    @Test
    void prunedQueueTokenAdmittedWhenRoomExists() {
        ConcurrencyManager manager = enabledManager(new InMemoryKeyValueStore());
        assertThat(manager.checkLoginAdmission(null)).isNull();
        manager.acquireSlot("acc-a");
        manager.onWsOpened("acc-a");

        // User was in queue (has a token) but entry was pruned
        // When room exists, they should be admitted, not sent to the back
        assertThat(manager.checkLoginAdmission(9999L)).isNull();
    }

    @Test
    void prunedQueueTokenRequeuedAtFrontWhenNoRoom() {
        ConcurrencyManager manager = enabledManager(new InMemoryKeyValueStore());

        // Fill all slots
        assertThat(manager.checkLoginAdmission(null)).isNull();
        manager.acquireSlot("acc-a");
        assertThat(manager.checkLoginAdmission(null)).isNull();
        manager.acquireSlot("acc-b");

        // User C gets queued normally at position 1
        QueuedLoginResponse c = manager.checkLoginAdmission(null);
        assertThat(c).isNotNull();
        long tokenC = c.getQueueToken();

        // User D also queued at position 2
        QueuedLoginResponse d = manager.checkLoginAdmission(null);
        assertThat(d).isNotNull();

        // Simulate: user C's entry gets pruned (stale)
        queueStore.remove(Long.toString(tokenC));

        // User C polls with their old token — should be re-queued at the FRONT,
        // NOT get a new token at the back
        QueuedLoginResponse requeued = manager.checkLoginAdmission(tokenC);
        assertThat(requeued).isNotNull();
        assertThat(requeued.getQueueToken()).isEqualTo(tokenC); // same token preserved
        assertThat(requeued.getQueuePosition()).isEqualTo(1);   // front of queue
    }

    @Test
    void killSwitchOffAdmitsQueuedUsersImmediately() {
        KeyValueStore kv = new InMemoryKeyValueStore();
        ConcurrencyManager manager = enabledManager(kv);

        // Fill slots and queue a user
        assertThat(manager.checkLoginAdmission(null)).isNull();
        manager.acquireSlot("acc-a");
        assertThat(manager.checkLoginAdmission(null)).isNull();
        manager.acquireSlot("acc-b");
        QueuedLoginResponse queued = manager.checkLoginAdmission(null);
        assertThat(queued).isNotNull();
        long token = queued.getQueueToken();

        // Kill switch: disable concurrency
        String disabledConfig = "{\"concurrencyControlEnabled\":false,\"maxConcurrentUsers\":2,\"idleDisconnectSeconds\":600}";
        kv.put(Constants.UI_CONFIG_JSON, disabledConfig);

        // Queued user polls — should be admitted immediately (config is off)
        assertThat(manager.checkLoginAdmission(token)).isNull();

        // New walk-in should also be admitted immediately
        assertThat(manager.checkLoginAdmission(null)).isNull();

        // All lifecycle hooks should be no-ops
        manager.acquireSlot("acc-c");
        assertThat(slotStore.activeSlotCount()).isEqualTo(2); // no new slot created
        manager.releaseSlot("acc-a");
        assertThat(slotStore.activeSlotCount()).isEqualTo(2); // slot not released
    }

    @Test
    void killSwitchReEnableCleansStaleSlotsDuringFirstSweep() {
        KeyValueStore kv = new InMemoryKeyValueStore();
        ConcurrencyManager manager = enabledManager(kv);

        // One user gets a slot
        assertThat(manager.checkLoginAdmission(null)).isNull();
        manager.acquireSlot("acc-a");
        manager.onWsOpened("acc-a");
        assertThat(slotStore.activeSlotCount()).isEqualTo(1);

        // Kill switch off
        String disabledConfig = "{\"concurrencyControlEnabled\":false,\"maxConcurrentUsers\":2,\"idleDisconnectSeconds\":600}";
        kv.put(Constants.UI_CONFIG_JSON, disabledConfig);

        // Slot stays in store (no-op release)
        manager.releaseSlot("acc-a");
        assertThat(slotStore.activeSlotCount()).isEqualTo(1); // still there

        // Re-enable — stale slots must be cleaned by the first reaper sweep
        kv.put(Constants.UI_CONFIG_JSON, ENABLED_CONFIG);
        forceExpireSlot(slotStore, "acc-a");
        manager.reapForTest();
        assertThat(slotStore.activeSlotCount()).isEqualTo(0); // cleaned up

        // New user should be admitted (no phantom slots blocking)
        assertThat(manager.checkLoginAdmission(null)).isNull();
    }

    @Test
    void killSwitchOffAndOnWithQueueEntriesPreservesFifo() {
        KeyValueStore kv = new InMemoryKeyValueStore();
        ConcurrencyManager manager = enabledManager(kv);

        // Fill slots and queue two users
        assertThat(manager.checkLoginAdmission(null)).isNull();
        manager.acquireSlot("acc-a");
        assertThat(manager.checkLoginAdmission(null)).isNull();
        manager.acquireSlot("acc-b");
        QueuedLoginResponse q1 = manager.checkLoginAdmission(null);
        assertThat(q1).isNotNull();
        long token1 = q1.getQueueToken();
        QueuedLoginResponse q2 = manager.checkLoginAdmission(null);
        assertThat(q2).isNotNull();
        long token2 = q2.getQueueToken();

        // Kill switch off
        String disabledConfig = "{\"concurrencyControlEnabled\":false,\"maxConcurrentUsers\":2,\"idleDisconnectSeconds\":600}";
        kv.put(Constants.UI_CONFIG_JSON, disabledConfig);

        // Both queued users admitted instantly while disabled
        assertThat(manager.checkLoginAdmission(token1)).isNull();
        assertThat(manager.checkLoginAdmission(token2)).isNull();

        // Re-enable
        kv.put(Constants.UI_CONFIG_JSON, ENABLED_CONFIG);

        // Queue entries from the disabled period are orphans — nobody is polling them.
        // Simulate realistic delay: after 90s+ they become stale and the reaper prunes them.
        forceExpireQueueEntry(kv, Long.toString(token1));
        forceExpireQueueEntry(kv, Long.toString(token2));

        manager.releaseSlot("acc-a");
        manager.releaseSlot("acc-b");
        forceExpireSlot(slotStore, "acc-a");
        forceExpireSlot(slotStore, "acc-b");
        manager.reapForTest();

        // Fresh start: stale queue entries pruned, stale slots cleaned — new walk-in admitted
        assertThat(manager.checkLoginAdmission(null)).isNull();
        manager.acquireSlot("acc-x");
        assertThat(slotStore.activeSlotCount()).isEqualTo(1);
    }

    @Test
    void killSwitchReEnableWithActiveWsUsersCountsSlotsCorrectly() {
        KeyValueStore kv = new InMemoryKeyValueStore();
        ConcurrencyManager manager = enabledManager(kv);

        // Two users with active slots and WS heartbeats
        assertThat(manager.checkLoginAdmission(null)).isNull();
        manager.acquireSlot("acc-a");
        manager.onWsOpened("acc-a");
        assertThat(manager.checkLoginAdmission(null)).isNull();
        manager.acquireSlot("acc-b");
        manager.onWsOpened("acc-b");
        assertThat(slotStore.activeSlotCount()).isEqualTo(2);

        // Kill switch off then back on
        String disabledConfig = "{\"concurrencyControlEnabled\":false,\"maxConcurrentUsers\":2,\"idleDisconnectSeconds\":600}";
        kv.put(Constants.UI_CONFIG_JSON, disabledConfig);
        kv.put(Constants.UI_CONFIG_JSON, ENABLED_CONFIG);

        // Slots are still there — heartbeats are fresh (not stale)
        assertThat(slotStore.activeSlotCount()).isEqualTo(2);

        // Third user must be queued — active users correctly count toward capacity
        QueuedLoginResponse third = manager.checkLoginAdmission(null);
        assertThat(third).isNotNull();
        assertThat(third.getQueuePosition()).isEqualTo(1);
    }

    @Test
    void limitOneAdmitsExactlyOneUser() {
        KeyValueStore kv = new InMemoryKeyValueStore();
        String limit1Config = "{\"concurrencyControlEnabled\":true,\"maxConcurrentUsers\":1,\"idleDisconnectSeconds\":600}";
        kv.put(Constants.UI_CONFIG_JSON, limit1Config);
        Invoker invoker = mockInvoker();
        ConcurrencyConfig config = new ConcurrencyConfig(kv);
        slotStore = new SlotStore(kv);
        queueStore = new QueueStore(kv);
        WaitTimeEstimator estimator = new WaitTimeEstimator(kv);
        ConcurrencyManager manager = new ConcurrencyManager(slotStore, queueStore, config,
                estimator, new NoOpTelemetryMetrics(), invoker);

        // First user admitted
        assertThat(manager.checkLoginAdmission(null)).isNull();
        manager.acquireSlot("acc-a");
        assertThat(slotStore.activeSlotCount()).isEqualTo(1);

        // Second user must be queued
        QueuedLoginResponse second = manager.checkLoginAdmission(null);
        assertThat(second).isNotNull();
        assertThat(second.getQueuePosition()).isEqualTo(1);

        // Logout frees slot, queued user polls and gets in
        manager.releaseSlot("acc-a");
        assertThat(slotStore.activeSlotCount()).isEqualTo(0);
        assertThat(manager.checkLoginAdmission(second.getQueueToken())).isNull();
        manager.acquireSlot("acc-b");
        assertThat(slotStore.activeSlotCount()).isEqualTo(1);
    }

    @Test
    void leaveQueueRemovesTicket() {
        ConcurrencyManager manager = enabledManager(new InMemoryKeyValueStore());
        assertThat(manager.checkLoginAdmission(null)).isNull();
        manager.acquireSlot("acc-a");
        assertThat(manager.checkLoginAdmission(null)).isNull();
        manager.acquireSlot("acc-b");

        // User queued
        QueuedLoginResponse queued = manager.checkLoginAdmission(null);
        assertThat(queued).isNotNull();
        assertThat(queueStore.depth()).isEqualTo(1);

        // Leave queue (e.g. user closes tab before being admitted)
        manager.leaveQueue(Long.toString(queued.getQueueToken()));
        assertThat(queueStore.depth()).isEqualTo(0);
    }

    @Test
    void pendingAdmissionsResetByReaper() {
        ConcurrencyManager manager = enabledManager(new InMemoryKeyValueStore());

        // Admit a user but never call acquireSlot (simulates login failure)
        assertThat(manager.checkLoginAdmission(null)).isNull();
        // pendingAdmissions = 1 now

        // Second user admitted
        assertThat(manager.checkLoginAdmission(null)).isNull();
        // pendingAdmissions = 2 now, should be at capacity

        // Third user queued (pending + slots = 2)
        QueuedLoginResponse third = manager.checkLoginAdmission(null);
        assertThat(third).isNotNull();

        // Reaper resets pendingAdmissions to 0
        manager.reapForTest();

        // Now third user should be admitted (pending reset, no actual slots)
        assertThat(manager.checkLoginAdmission(third.getQueueToken())).isNull();
    }

    private static void forceExpireSlot(SlotStore slotStore, String accountId) {
        long expired = System.currentTimeMillis() - ConcurrencyConstants.SLOT_STALE_MS - 1000;
        slotStore.getStore().put(
                ConcurrencyConstants.SLOT_KEY_PREFIX + accountId,
                "0|" + expired + "|0");
    }

    private static void forceExpireQueueEntry(KeyValueStore kv, String accountId) {
        long expired = System.currentTimeMillis() - ConcurrencyConstants.QUEUE_TICKET_STALE_MS - 1000;
        kv.put(ConcurrencyConstants.QUEUE_KEY_PREFIX + accountId, "0|" + expired);
    }
}
