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

package app.krista.extensions.essentials.collaboration.omnichatbot.resource.dto;

/**
 * Returned by {@code POST /authn/login} when the concurrent-user limit is
 * reached and the caller must wait in a FIFO queue. The frontend shows a
 * waiting screen and re-calls login with the same {@code queueToken} at
 * {@code pollIntervalMs} intervals until a seat frees up.
 */
public class QueuedLoginResponse {

    public static final int CODE_MAX_LIMIT_REACHED = 1001;
    public static final String MESSAGE_MAX_LIMIT_REACHED = "MaxLimitReached";

    private final int code;
    private final String message;
    private final long queueToken;
    private final int queuePosition;
    private final long estimatedWaitMs;
    private final int pollIntervalMs;

    public QueuedLoginResponse(long queueToken, int queuePosition, long estimatedWaitMs, int pollIntervalMs) {
        this.code = CODE_MAX_LIMIT_REACHED;
        this.message = MESSAGE_MAX_LIMIT_REACHED;
        this.queueToken = queueToken;
        this.queuePosition = queuePosition;
        this.estimatedWaitMs = estimatedWaitMs;
        this.pollIntervalMs = pollIntervalMs;
    }

    public int getCode() {
        return code;
    }

    public long getQueueToken() {
        return queueToken;
    }

    public int getQueuePosition() {
        return queuePosition;
    }

    public String getMessage() {
        return message;
    }

    public long getEstimatedWaitMs() {
        return estimatedWaitMs;
    }

    public int getPollIntervalMs() {
        return pollIntervalMs;
    }
}