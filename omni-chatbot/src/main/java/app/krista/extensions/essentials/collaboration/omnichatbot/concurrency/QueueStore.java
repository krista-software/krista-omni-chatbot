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

import app.krista.extensions.util.KeyValueStore;
import org.jvnet.hk2.annotations.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.inject.Inject;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Distributed FIFO waiting queue, backed by the shared {@link KeyValueStore}
 * (Infinispan) with a per-node in-memory read cache.
 *
 * <p><b>Coherence contract.</b> The KeyValueStore is the single source of truth:
 * every mutation writes it first, then mirrors to {@link #cache}. Decisions that
 * must be correct cluster-wide — popping the head, enqueue idempotency — read the
 * KeyValueStore directly. Only display reads (position, depth) use the local
 * cache, so the worst case is a position number that is a few seconds stale on a
 * node until the next {@link #rehydrate()} (run at startup and at the top of every
 * reaper tick). This honours the "KV + cache, rehydrate on restart" design without
 * letting a stale cache cause an incorrect admission.
 *
 * <p>A ticket is one key ({@code __cc_queue__:<accountId>}) whose value encodes
 * {@code enqueueMillis|lastSeen}. FIFO order is by {@code enqueueMillis} (wall
 * clock; with no atomic cluster sequence available, clock skew across nodes can
 * reorder near-simultaneous enqueues — an accepted limitation), tie-broken by
 * accountId. {@code lastSeen} is refreshed on every status poll; the reaper prunes
 * tickets whose {@code lastSeen} is stale (tab closed / navigated away).
 */
@Service
public class QueueStore {

    private static final Logger LOGGER = LoggerFactory.getLogger(QueueStore.class);
    private static final char ENCODE_SEP = '|';
    private static final Comparator<TicketSnapshot> FIFO_ORDER =
            Comparator.comparingLong(TicketSnapshot::enqueueMillis).thenComparing(TicketSnapshot::accountId);

    private final KeyValueStore store;
    private final Map<String, TicketEntry> cache = new ConcurrentHashMap<>();

    @Inject
    public QueueStore(KeyValueStore keyValueStore) {
        this.store = keyValueStore;
    }

    /**
     * Adds the account to the tail of the queue, or refreshes its heartbeat if it is
     * already queued (idempotent per account — multiple tabs / repeated requests do
     * not create duplicate tickets and keep the original FIFO position).
     *
     * @return the account's enqueue timestamp (original, if it was already queued).
     */
    public synchronized long enqueue(String accountId, long nowMillis) {
        TicketEntry existing = decode(asString(store.get(queueKey(accountId))));
        long enqueueMillis = existing == null ? nowMillis : existing.enqueueMillis();
        write(accountId, enqueueMillis, nowMillis);
        return enqueueMillis;
    }

    /**
     * Re-enqueues a ticket at the front of the queue with a fresh heartbeat.
     * Used to restore a user whose ticket was pruned but who was still actively
     * polling — preserves their FIFO priority instead of sending them to the back.
     */
    public synchronized void requeueAtFront(String accountId, long nowMillis) {
        write(accountId, 0L, nowMillis);
    }

    /** Refreshes the ticket heartbeat on a status poll. No-op if not queued. */
    public synchronized void touch(String accountId, long nowMillis) {
        TicketEntry existing = decode(asString(store.get(queueKey(accountId))));
        if (existing != null) {
            write(accountId, existing.enqueueMillis(), nowMillis);
        }
    }

    public boolean contains(String accountId) {
        return store.contains(queueKey(accountId));
    }

    public synchronized void remove(String accountId) {
        store.remove(queueKey(accountId));
        cache.remove(accountId);
    }

    /**
     * 1-based position of the account among non-stale tickets, computed from the
     * local cache (display read). Returns {@code 0} if the account is not queued.
     */
    public int position(String accountId) {
        TicketEntry mine = cache.get(accountId);
        if (mine == null) {
            return 0;
        }
        long staleBefore = System.currentTimeMillis() - ConcurrencyConstants.QUEUE_TICKET_STALE_MS;
        int ahead = 0;
        for (Map.Entry<String, TicketEntry> e : cache.entrySet()) {
            TicketEntry other = e.getValue();
            if (other.lastSeen() < staleBefore) {
                continue;
            }
            boolean isBefore = other.enqueueMillis() < mine.enqueueMillis()
                    || (other.enqueueMillis() == mine.enqueueMillis() && e.getKey().compareTo(accountId) < 0);
            if (isBefore) {
                ahead++;
            }
        }
        return ahead + 1;
    }

    /** Number of non-stale waiting tickets, from the local cache (display read). */
    public int depth() {
        long staleBefore = System.currentTimeMillis() - ConcurrencyConstants.QUEUE_TICKET_STALE_MS;
        int count = 0;
        for (TicketEntry entry : cache.values()) {
            if (entry.lastSeen() >= staleBefore) {
                count++;
            }
        }
        return count;
    }

    /**
     * Returns the key at the head of the queue (earliest non-stale ticket) without
     * removing it. Reads the authoritative KeyValueStore. Returns {@code null} when
     * the queue is empty.
     */
    public synchronized String peekHead() {
        return authoritativeTickets().stream()
                .filter(t -> !isStale(t.lastSeen()))
                .min(FIFO_ORDER)
                .map(TicketSnapshot::accountId)
                .orElse(null);
    }

    /**
     * Removes and returns the account at the head of the queue (earliest non-stale
     * ticket), reading the authoritative KeyValueStore. Returns {@code null} when the
     * queue is empty.
     */
    public synchronized String popHead() {
        TicketSnapshot head = authoritativeTickets().stream()
                .filter(t -> !isStale(t.lastSeen()))
                .min(FIFO_ORDER)
                .orElse(null);
        if (head == null) {
            return null;
        }
        store.remove(queueKey(head.accountId()));
        cache.remove(head.accountId());
        return head.accountId();
    }

    /**
     * Prunes tickets whose heartbeat is stale (abandoned). Reads the authoritative
     * store so it cleans up tickets enqueued on any node.
     *
     * @return the number of tickets pruned.
     */
    public synchronized int pruneStale() {
        int pruned = 0;
        for (TicketSnapshot ticket : authoritativeTickets()) {
            if (isStale(ticket.lastSeen())) {
                store.remove(queueKey(ticket.accountId()));
                cache.remove(ticket.accountId());
                pruned++;
            }
        }
        return pruned;
    }

    /** Rebuilds the local read cache from the authoritative store. */
    public synchronized void rehydrate() {
        Map<String, TicketEntry> rebuilt = new ConcurrentHashMap<>();
        for (TicketSnapshot ticket : authoritativeTickets()) {
            rebuilt.put(ticket.accountId(), new TicketEntry(ticket.enqueueMillis(), ticket.lastSeen()));
        }
        cache.clear();
        cache.putAll(rebuilt);
    }

    /** Authoritative ticket count (store scan), used by the safety-ceiling guard. */
    public int authoritativeDepth() {
        return authoritativeTickets().size();
    }

    private List<TicketSnapshot> authoritativeTickets() {
        List<TicketSnapshot> result = new ArrayList<>();
        for (String key : store.getKeys()) {
            if (key != null && key.startsWith(ConcurrencyConstants.QUEUE_KEY_PREFIX)) {
                TicketEntry entry = decode(asString(store.get(key)));
                if (entry != null) {
                    result.add(new TicketSnapshot(key.substring(ConcurrencyConstants.QUEUE_KEY_PREFIX.length()),
                            entry.enqueueMillis(), entry.lastSeen()));
                }
            }
        }
        return result;
    }

    private void write(String accountId, long enqueueMillis, long lastSeen) {
        store.put(queueKey(accountId), encode(enqueueMillis, lastSeen));
        cache.put(accountId, new TicketEntry(enqueueMillis, lastSeen));
    }

    private static boolean isStale(long lastSeen) {
        return lastSeen < System.currentTimeMillis() - ConcurrencyConstants.QUEUE_TICKET_STALE_MS;
    }

    private static String queueKey(String accountId) {
        return ConcurrencyConstants.QUEUE_KEY_PREFIX + accountId;
    }

    private static String encode(long enqueueMillis, long lastSeen) {
        return enqueueMillis + String.valueOf(ENCODE_SEP) + lastSeen;
    }

    private static TicketEntry decode(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        int sep = raw.indexOf(ENCODE_SEP);
        if (sep < 0) {
            return null;
        }
        try {
            long enqueueMillis = Long.parseLong(raw.substring(0, sep));
            long lastSeen = Long.parseLong(raw.substring(sep + 1));
            return new TicketEntry(enqueueMillis, lastSeen);
        } catch (NumberFormatException cause) {
            LOGGER.warn("#####-CHATBOT-CONCURRENCY unparseable queue value '{}'", raw);
            return null;
        }
    }

    private static String asString(Object value) {
        return value == null ? null : value.toString();
    }

    private record TicketEntry(long enqueueMillis, long lastSeen) {
    }

    private record TicketSnapshot(String accountId, long enqueueMillis, long lastSeen) {
    }
}
