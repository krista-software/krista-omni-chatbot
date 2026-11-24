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

import java.util.Iterator;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Tracks which inboxes have already had their welcome conversation triggered for
 * the current WebSocket session, so the server-side auto-trigger and the legacy
 * frontend-initiated "welcome" payload don't both run the conversation twice.
 *
 * <p>Entries are added by whichever path runs first (auto-trigger or payload
 * handler) and cleared when the WS connection closes. Abnormal closes
 * (network drop, peer restart) skip the close-handler path, so the set has a
 * hard size cap ({@link #MAX_TRACKED}) with weak-LRU eviction to keep memory
 * bounded for the JVM's lifetime.
 */
public final class WelcomeExecutionTracker {

    // Bounded — chosen to comfortably cover concurrent active sessions on a
    // busy chatbot (~100s) plus weeks of leaked entries from abnormal closes
    // before eviction kicks in. Each entry is a short inbox-ID string, so
    // 10K entries is ~1 MB worst case.
    private static final int MAX_TRACKED = 10_000;

    private static final Set<String> startedForInbox = ConcurrentHashMap.newKeySet();

    private WelcomeExecutionTracker() {
    }

    // Atomic check-and-mark. Returns true if the caller is the first to start
    // welcome for this inbox (caller should proceed to execute). Returns false
    // if another path already started it (caller should skip).
    public static boolean tryStart(String inboxId) {
        if (inboxId == null || !startedForInbox.add(inboxId)) {
            return false;
        }
        // Soft cap: if the set has grown past MAX_TRACKED (almost always
        // because abnormal closes are leaving stale entries behind), evict
        // entries until we're back under the bound. ConcurrentHashMap's
        // iterator order is weakly consistent — not strict LRU, but bounded
        // and safe under concurrent access.
        while (startedForInbox.size() > MAX_TRACKED) {
            Iterator<String> it = startedForInbox.iterator();
            if (!it.hasNext()) {
                break;
            }
            it.next();
            it.remove();
        }
        return true;
    }

    public static void onConnectionClosed(String inboxId) {
        if (inboxId != null) {
            startedForInbox.remove(inboxId);
        }
    }
}
