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
import java.util.List;

/**
 * Distributed store for active concurrency "slots" and short-lived admission
 * "reservations", backed by the shared {@link KeyValueStore} (Infinispan,
 * cross-node).
 *
 * <p><b>Slot model.</b> One slot == one distinct guest {@code accountId} holding
 * at least one live chat WebSocket for this invoker. A slot is a single key
 * ({@code __cc_slot__:<accountId>}) whose value encodes
 * {@code refcount|lastSeen|firstAcquired}:
 * <ul>
 *   <li>{@code refcount} — number of live WS connections (browser tabs) for the
 *       account; the slot is released only when it drops to zero, so multiple tabs
 *       count as one user.</li>
 *   <li>{@code lastSeen} — epoch millis of the last heartbeat (refreshed off WS
 *       pings); the reaper reclaims slots whose heartbeat is stale (node crash /
 *       abrupt close).</li>
 *   <li>{@code firstAcquired} — epoch millis the slot was first taken, used to
 *       measure the session duration that feeds the wait-time estimator.</li>
 * </ul>
 * Because the platform guarantees a user's WS always reaches the same node, only
 * the owning node ever mutates a given account's slot key, so the read-modify-write
 * here is safe without a distributed lock (which the platform does not expose).
 *
 * <p>This store carries no business logic or telemetry — see {@code ConcurrencyManager}.
 */
@Service
public class SlotStore {

    private static final Logger LOGGER = LoggerFactory.getLogger(SlotStore.class);
    private static final char ENCODE_SEP = '|';

    private final KeyValueStore store;

    @Inject
    public SlotStore(KeyValueStore keyValueStore) {
        this.store = keyValueStore;
    }

    KeyValueStore getStore() {
        return store;
    }

    /**
     * Increments the connection ref-count for the account, creating the slot on the
     * first connection (stamping {@code firstAcquired}), and refreshes the heartbeat.
     *
     * @return the ref-count after acquisition.
     */
    public int acquireConnection(String accountId, long nowMillis) {
        SlotEntry existing = readSlot(accountId);
        int refcount = (existing == null ? 0 : existing.refcount()) + 1;
        long firstAcquired = existing == null ? nowMillis : existing.firstAcquired();
        store.put(slotKey(accountId), encode(refcount, nowMillis, firstAcquired));
        return refcount;
    }

    /**
     * Decrements the connection ref-count for the account. When refcount drops
     * to zero the slot is NOT removed — it enters a grace period so a transient
     * network blip or page refresh does not lose the seat. The background reaper
     * frees it after {@code SLOT_STALE_MS} if no reconnect arrives.
     *
     * @return the ref-count after release ({@code 0} means grace period started).
     */
    public int releaseConnection(String accountId, long nowMillis) {
        SlotEntry existing = readSlot(accountId);
        if (existing == null) {
            return 0;
        }
        int refcount = existing.refcount() - 1;
        if (refcount <= 0) {
            store.put(slotKey(accountId), encode(0, nowMillis, existing.firstAcquired()));
            return 0;
        }
        store.put(slotKey(accountId), encode(refcount, nowMillis, existing.firstAcquired()));
        return refcount;
    }

    /**
     * Refreshes the heartbeat for an existing slot (no ref-count change). No-op if
     * the slot does not exist.
     */
    public void heartbeat(String accountId, long nowMillis) {
        SlotEntry existing = readSlot(accountId);
        if (existing != null) {
            store.put(slotKey(accountId), encode(existing.refcount(), nowMillis, existing.firstAcquired()));
        }
    }

    public boolean hasSlot(String accountId) {
        SlotEntry entry = readSlot(accountId);
        return entry != null && entry.refcount() > 0;
    }

    /** Epoch millis the slot was first acquired, or {@code 0} if no slot exists. */
    public long slotFirstAcquired(String accountId) {
        SlotEntry existing = readSlot(accountId);
        return existing == null ? 0L : existing.firstAcquired();
    }

    /** Forcibly removes a slot (reaper reclaim of a leaked entry). */
    public void removeSlot(String accountId) {
        store.remove(slotKey(accountId));
    }

    /**
     * Total slot count (including grace-period slots with refcount=0). Used for
     * capacity checks — a grace-period slot still holds the seat.
     */
    public int activeSlotCount() {
        return countByPrefix(ConcurrencyConstants.SLOT_KEY_PREFIX);
    }

    /** Snapshot of all current slots, for the reaper to evaluate staleness. */
    public List<SlotSnapshot> allSlots() {
        List<SlotSnapshot> result = new ArrayList<>();
        for (String key : store.getKeys()) {
            if (key != null && key.startsWith(ConcurrencyConstants.SLOT_KEY_PREFIX)) {
                SlotEntry entry = decode(asString(store.get(key)));
                if (entry != null) {
                    result.add(new SlotSnapshot(key.substring(ConcurrencyConstants.SLOT_KEY_PREFIX.length()), entry.refcount(), entry.lastSeen()));
                }
            }
        }
        return result;
    }

    private SlotEntry readSlot(String accountId) {
        return decode(asString(store.get(slotKey(accountId))));
    }

    private int countByPrefix(String prefix) {
        int count = 0;
        for (String key : store.getKeys()) {
            if (key != null && key.startsWith(prefix)) {
                count++;
            }
        }
        return count;
    }

    private static String slotKey(String accountId) {
        return ConcurrencyConstants.SLOT_KEY_PREFIX + accountId;
    }

    private static String encode(int refcount, long lastSeen, long firstAcquired) {
        return refcount + String.valueOf(ENCODE_SEP) + lastSeen + ENCODE_SEP + firstAcquired;
    }

    private static SlotEntry decode(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String[] parts = raw.split("\\" + ENCODE_SEP);
        if (parts.length < 3) {
            return null;
        }
        try {
            int refcount = Integer.parseInt(parts[0]);
            long lastSeen = Long.parseLong(parts[1]);
            long firstAcquired = Long.parseLong(parts[2]);
            return new SlotEntry(refcount, lastSeen, firstAcquired);
        } catch (NumberFormatException cause) {
            LOGGER.warn("#####-CHATBOT-CONCURRENCY unparseable slot value '{}'", raw);
            return null;
        }
    }

    private static String asString(Object value) {
        return value == null ? null : value.toString();
    }

    private record SlotEntry(int refcount, long lastSeen, long firstAcquired) {
    }

    /** Public projection used by the reaper / manager. */
    public record SlotSnapshot(String accountId, int refcount, long lastSeen) {
    }
}
