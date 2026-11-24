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

class QueueStoreTest {

    private InMemoryKeyValueStore kv;
    private QueueStore queueStore;

    @BeforeEach
    void setUp() {
        kv = new InMemoryKeyValueStore();
        queueStore = new QueueStore(kv);
    }

    @Test
    void enqueueIsIdempotentAndKeepsOriginalOrder() {
        long base = System.currentTimeMillis();
        long first = queueStore.enqueue("a", base);
        long again = queueStore.enqueue("a", base + 4000);
        assertThat(again).isEqualTo(first);
        assertThat(queueStore.depth()).isEqualTo(1);
    }

    @Test
    void fifoOrderByEnqueueTime() {
        long now = System.currentTimeMillis();
        queueStore.enqueue("a", now);
        queueStore.enqueue("b", now + 10);
        queueStore.enqueue("c", now + 20);
        assertThat(queueStore.position("a")).isEqualTo(1);
        assertThat(queueStore.position("b")).isEqualTo(2);
        assertThat(queueStore.position("c")).isEqualTo(3);
        assertThat(queueStore.popHead()).isEqualTo("a");
        assertThat(queueStore.popHead()).isEqualTo("b");
        assertThat(queueStore.popHead()).isEqualTo("c");
        assertThat(queueStore.popHead()).isNull();
    }

    @Test
    void positionIsZeroWhenNotQueued() {
        assertThat(queueStore.position("ghost")).isEqualTo(0);
    }

    @Test
    void removeDropsTicket() {
        long now = System.currentTimeMillis();
        queueStore.enqueue("a", now);
        queueStore.remove("a");
        assertThat(queueStore.contains("a")).isFalse();
        assertThat(queueStore.depth()).isEqualTo(0);
    }

    @Test
    void pruneStaleRemovesAbandonedTickets() {
        long now = System.currentTimeMillis();
        long stale = now - (ConcurrencyConstants.QUEUE_TICKET_STALE_MS + 5000);
        queueStore.enqueue("old", stale);
        queueStore.enqueue("fresh", now);
        int pruned = queueStore.pruneStale();
        assertThat(pruned).isEqualTo(1);
        assertThat(queueStore.contains("old")).isFalse();
        assertThat(queueStore.contains("fresh")).isTrue();
    }

    @Test
    void staleTicketsAreNotCountedInDepthOrPosition() {
        long now = System.currentTimeMillis();
        long stale = now - (ConcurrencyConstants.QUEUE_TICKET_STALE_MS + 5000);
        queueStore.enqueue("old", stale);
        queueStore.enqueue("fresh", now);
        assertThat(queueStore.depth()).isEqualTo(1);
        assertThat(queueStore.position("fresh")).isEqualTo(1);
    }

    @Test
    void peekHeadReturnsHeadWithoutRemoving() {
        assertThat(queueStore.peekHead()).isNull();
        long now = System.currentTimeMillis();
        queueStore.enqueue("a", now);
        queueStore.enqueue("b", now + 10);
        assertThat(queueStore.peekHead()).isEqualTo("a");
        assertThat(queueStore.depth()).isEqualTo(2);
        assertThat(queueStore.peekHead()).isEqualTo("a");
    }

    @Test
    void requeueAtFrontPlacesUserAtPositionOne() {
        long now = System.currentTimeMillis();
        queueStore.enqueue("a", now);
        queueStore.enqueue("b", now + 10);
        queueStore.enqueue("c", now + 20);
        assertThat(queueStore.position("c")).isEqualTo(3);

        // Remove c (pruned by reaper) then requeue at front
        queueStore.remove("c");
        queueStore.requeueAtFront("c", now + 30);

        // c should now be at position 1 (enqueueMillis=0 is earliest)
        assertThat(queueStore.position("c")).isEqualTo(1);
        assertThat(queueStore.position("a")).isEqualTo(2);
        assertThat(queueStore.position("b")).isEqualTo(3);

        // popHead should return c first
        assertThat(queueStore.popHead()).isEqualTo("c");
    }

    @Test
    void requeueAtFrontWithMultipleUsersPreservesFifo() {
        long now = System.currentTimeMillis();
        queueStore.enqueue("a", now);
        queueStore.enqueue("b", now + 10);

        // Both pruned and requeued — second requeue still uses enqueueMillis=0
        // so tie-break by accountId: "a" < "b"
        queueStore.remove("a");
        queueStore.remove("b");
        queueStore.requeueAtFront("b", now + 100);
        queueStore.requeueAtFront("a", now + 200);

        // Both at enqueueMillis=0, tie-broken by accountId lexicographically
        assertThat(queueStore.position("a")).isEqualTo(1);
        assertThat(queueStore.position("b")).isEqualTo(2);
    }

    @Test
    void rehydrateRebuildsCacheFromStoreForANewInstance() {
        long now = System.currentTimeMillis();
        queueStore.enqueue("a", now);
        queueStore.enqueue("b", now + 10);
        // Simulate a restart: a brand-new QueueStore over the same backing store
        QueueStore restarted = new QueueStore(kv);
        // Before rehydrate the local read-cache is empty
        assertThat(restarted.position("a")).isEqualTo(0);
        restarted.rehydrate();
        assertThat(restarted.position("a")).isEqualTo(1);
        assertThat(restarted.position("b")).isEqualTo(2);
        assertThat(restarted.depth()).isEqualTo(2);
    }
}
