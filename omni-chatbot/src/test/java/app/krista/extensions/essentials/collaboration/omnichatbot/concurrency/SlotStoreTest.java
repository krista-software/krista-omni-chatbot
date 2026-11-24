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

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SlotStoreTest {

    private SlotStore slotStore;

    @BeforeEach
    void setUp() {
        slotStore = new SlotStore(new InMemoryKeyValueStore());
    }

    @Test
    void acquireCreatesSlotAndCountsOnce() {
        slotStore.acquireConnection("a", 1000L);
        assertThat(slotStore.hasSlot("a")).isTrue();
        assertThat(slotStore.activeSlotCount()).isEqualTo(1);
    }

    @Test
    void multipleTabsShareOneSlotWithGracePeriod() {
        slotStore.acquireConnection("a", 1000L);
        int refAfterSecondTab = slotStore.acquireConnection("a", 1100L);
        assertThat(refAfterSecondTab).isEqualTo(2);
        assertThat(slotStore.activeSlotCount()).isEqualTo(1);

        int refAfterFirstClose = slotStore.releaseConnection("a", 1200L);
        assertThat(refAfterFirstClose).isEqualTo(1);
        assertThat(slotStore.hasSlot("a")).isTrue();

        int refAfterLastClose = slotStore.releaseConnection("a", 1300L);
        assertThat(refAfterLastClose).isEqualTo(0);
        // Grace period: slot key stays in store (counted by activeSlotCount) but
        // hasSlot returns false because refcount=0 means no active connection
        assertThat(slotStore.hasSlot("a")).isFalse();
        assertThat(slotStore.activeSlotCount()).isEqualTo(1);
    }

    @Test
    void gracePeriodSlotCanBeReacquired() {
        slotStore.acquireConnection("a", 1000L);
        slotStore.releaseConnection("a", 2000L); // refcount=0, grace starts
        assertThat(slotStore.hasSlot("a")).isFalse(); // no active connection

        // Reconnect during grace — refcount goes back to 1
        int ref = slotStore.acquireConnection("a", 3000L);
        assertThat(ref).isEqualTo(1);
        assertThat(slotStore.hasSlot("a")).isTrue();
    }

    @Test
    void gracePeriodSlotReclaimedByRemoveSlot() {
        slotStore.acquireConnection("a", 1000L);
        slotStore.releaseConnection("a", 2000L);
        assertThat(slotStore.hasSlot("a")).isFalse(); // refcount=0

        slotStore.removeSlot("a"); // reaper reclaim
        assertThat(slotStore.hasSlot("a")).isFalse();
        assertThat(slotStore.activeSlotCount()).isEqualTo(0);
    }

    @Test
    void firstAcquiredIsStableAcrossReacquire() {
        slotStore.acquireConnection("a", 5000L);
        slotStore.acquireConnection("a", 9000L);
        assertThat(slotStore.slotFirstAcquired("a")).isEqualTo(5000L);
        slotStore.heartbeat("a", 12000L);
        assertThat(slotStore.slotFirstAcquired("a")).isEqualTo(5000L);
    }

    @Test
    void heartbeatUpdatesLastSeenForReaperSnapshot() {
        slotStore.acquireConnection("a", 1000L);
        slotStore.heartbeat("a", 7777L);
        assertThat(slotStore.allSlots()).singleElement()
                .satisfies(s -> {
                    assertThat(s.accountId()).isEqualTo("a");
                    assertThat(s.lastSeen()).isEqualTo(7777L);
                });
    }

    @Test
    void removeSlotReclaimsLeakedEntry() {
        slotStore.acquireConnection("a", 1000L);
        slotStore.removeSlot("a");
        assertThat(slotStore.hasSlot("a")).isFalse();
        assertThat(slotStore.activeSlotCount()).isEqualTo(0);
    }

    @Test
    void releaseUnknownAccountIsSafe() {
        assertThat(slotStore.releaseConnection("missing", 1000L)).isEqualTo(0);
    }
}
