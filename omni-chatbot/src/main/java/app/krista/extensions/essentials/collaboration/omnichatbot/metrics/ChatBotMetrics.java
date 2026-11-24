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

package app.krista.extensions.essentials.collaboration.omnichatbot.metrics;

import io.opentelemetry.api.trace.Span;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.Map;

/**
 * Centralized, span-based telemetry for the Omni Chatbot extension.
 *
 * <p>Every event is emitted as a discrete OpenTelemetry <b>span</b> through the
 * extension-owned {@link ChatBotTracerProvider} (its own OTLP exporter — the platform
 * tracer drops spans). Each event is one immutable, timestamped span, so SigNoz
 * {@code count()} queries over the Traces source are <b>restart-safe</b>: nothing
 * accumulates in-process, so a JVM / invoker recycle cannot reset the totals (unlike
 * cumulative counters, which restart at 0).
 *
 * <p>Every span carries {@code service.name=omni-chatbot} plus {@code chatbot.operation},
 * {@code chatbot.workspace.id} and {@code chatbot.invoker.id}, so events can be sliced
 * per workspace / per invoker in SigNoz.
 *
 * <p>All recording methods are null-safe and never throw — a telemetry fault can never
 * break a chat turn.
 *
 * <h3>SigNoz query cheat-sheet (Traces source, {@code service.name='omni-chatbot'})</h3>
 * <ul>
 *   <li><b>Guest logins</b>: {@code chatbot.operation='guest.account.created'} → count()</li>
 *   <li><b>Active users</b>: count(op='ws.connection.opened') − count(op='ws.connection.closed')
 *       over the window (or count distinct {@code chatbot.account.id} of opens not yet closed)</li>
 *   <li><b>Invokers not in use</b>: distinct {@code chatbot.invoker.id} of op='invoker.loaded'
 *       MINUS distinct {@code chatbot.invoker.id} appearing on any event span in the window</li>
 *   <li><b>Login failures</b>: {@code chatbot.operation='auth.attempt' AND auth.result='failure'} → count()</li>
 *   <li><b>Chat start failures by type</b>: {@code chatbot.operation='chat.start.failure'} → count(), group by chat.start.failure.reason
 *       ({@code guest_account_unavailable} / {@code welcome_unavailable} / {@code platform_error})</li>
 *   <li><b>Other failures</b>: {@code chatbot.operation='error'} → count(), group by error.source / error.type</li>
 *   <li><b>Incoming messages (1h)</b>: {@code chatbot.operation='ws.message.received'} → count() over 1h</li>
 *   <li><b>Outgoing messages (1h)</b>: {@code chatbot.operation='ws.message.sent'} → count() over 1h</li>
 * </ul>
 */
public class ChatBotMetrics {

    private static final Logger LOGGER = LoggerFactory.getLogger(ChatBotMetrics.class);
    private static volatile ChatBotMetrics instance;
    // Captured at init (invoker-level identity) so every span can be filtered by
    // workspace / invoker in SigNoz, mirroring the AgenticAI span attributes.
    private final String workspaceId;
    private final String invokerId;

    private ChatBotMetrics(String workspaceId, String invokerId) {
        this.workspaceId = workspaceId;
        this.invokerId = invokerId;
    }

    public static synchronized void initialize(String workspaceId, String invokerId) {
        if (instance == null) {
            instance = new ChatBotMetrics(workspaceId, invokerId);
        }
    }

    public static synchronized void shutdown() {
        instance = null;
    }

    // ------------------------------------------------------------------ core

    /**
     * Emits one discrete span for {@code operation} with the given string attributes plus
     * the base workspace / invoker identity. Never throws — telemetry must not break the
     * chat flow.
     */
    private static void emit(String operation, Map<String, String> attributes) {
        ChatBotMetrics m = instance;
        if (m == null) {
            return;
        }
        try {
            Span span = ChatBotTracerProvider.getInstance().getTracer()
                    .spanBuilder("chatbot." + operation)
                    .setAttribute("chatbot.operation", operation)
                    .startSpan();
            try {
                if (m.workspaceId != null) {
                    span.setAttribute("chatbot.workspace.id", m.workspaceId);
                }
                if (m.invokerId != null) {
                    span.setAttribute("chatbot.invoker.id", m.invokerId);
                }
                if (attributes != null) {
                    for (Map.Entry<String, String> e : attributes.entrySet()) {
                        if (e.getValue() != null) {
                            span.setAttribute(e.getKey(), e.getValue());
                        }
                    }
                }
            } finally {
                span.end();
            }
        } catch (Throwable t) {
            LOGGER.debug("#####-CHATBOT-METRICS span suppressed (op={}): {}", operation, t.toString());
        }
    }

    private static void emit(String operation) {
        emit(operation, null);
    }

    // ------------------------------------------------------------- lifecycle

    /**
     * One span per invoker load. "Invokers not in use" = invoker ids seen here but never on
     * any event span in the window.
     */
    public static void recordInvokerLoaded() {
        emit("invoker.loaded");
    }

    // --------------------------------------------------- connections / users

    public static void recordConnectionOpened(String accountId) {
        emit("ws.connection.opened", accountId == null ? null : Map.of("chatbot.account.id", accountId));
    }

    public static void recordConnectionClosed(String accountId) {
        emit("ws.connection.closed", accountId == null ? null : Map.of("chatbot.account.id", accountId));
    }

    // ------------------------------------------------------------- messages

    public static void recordMessageReceived(String messageType, String accountId) {
        String type = messageType != null ? messageType : "unknown";
        Map<String, String> attrs = new HashMap<>();
        attrs.put("message.type", type);
        if (accountId != null) {
            attrs.put("chatbot.account.id", accountId);
        }
        emit("ws.message.received", attrs);
    }

    /**
     * DIAGNOSTIC — one span for EVERY raw WebSocket frame the extension receives at the
     * outermost protocol entry ({@code ChatBotProtocolHandler}), tagged with the frame class
     * (e.g. {@code WsTextMessageReceived}, {@code WsConnectionOpened}). This is the definitive
     * probe for whether inbound user-message frames reach the extension at all, or are handled
     * entirely platform-side. Group by {@code ws.frame.type} in SigNoz.
     */
    public static void recordWsFrame(String frameType, String signal, String payloadType) {
        Map<String, String> attrs = new HashMap<>();
        attrs.put("ws.frame.type", frameType != null ? frameType : "unknown");
        if (signal != null) {
            attrs.put("ws.frame.signal", signal);
        }
        if (payloadType != null) {
            attrs.put("ws.frame.payload_type", payloadType);
        }
        emit("ws.frame", attrs);
    }

    public static void recordMessageSent(String accountId) {
        emit("ws.message.sent", accountId == null ? null : Map.of("chatbot.account.id", accountId));
    }

    public static void recordActiveMqMessageSent() {
        emit("activemq.message.sent");
    }

    public static void recordNotificationSent(String notificationType) {
        emit("notification.sent",
                Map.of("notification.type", notificationType != null ? notificationType : "unknown"));
    }

    // ----------------------------------------------------------- auth / login

    public static void recordAuthAttempt(String result, String protocol) {
        emit("auth.attempt", Map.of(
                "auth.result", result != null ? result : "unknown",
                "auth.protocol", protocol != null ? protocol : "unknown"));
    }

    // -------------------------------------------------------- sessions / users

    public static void recordSessionCreated() {
        emit("session.created");
    }

    public static void recordNewUser() {
        emit("user.new");
    }

    public static void recordGuestAccountCreated() {
        emit("guest.account.created");
    }

    public static void recordSessionEnded(String reason) {
        emit("session.ended", Map.of("end.reason", reason != null ? reason : "unknown"));
    }

    public static void recordSessionDuration(double durationSeconds) {
        ChatBotMetrics m = instance;
        if (m == null) {
            return;
        }
        try {
            long durationMs = (long) (durationSeconds * 1000);
            Span span = ChatBotTracerProvider.getInstance().getTracer()
                    .spanBuilder("chatbot.session.duration")
                    .setAttribute("chatbot.operation", "session.duration")
                    .setAttribute("chatbot.duration_ms", durationMs)
                    .startSpan();
            try {
                if (m.workspaceId != null) {
                    span.setAttribute("chatbot.workspace.id", m.workspaceId);
                }
                if (m.invokerId != null) {
                    span.setAttribute("chatbot.invoker.id", m.invokerId);
                }
            } finally {
                span.end();
            }
        } catch (Throwable t) {
            LOGGER.debug("#####-CHATBOT-METRICS session-duration span suppressed: {}", t.toString());
        }
    }

    // --------------------------------------------------------- errors / failures

    public static void recordError(String source, Throwable cause) {
        String errorSource = source != null ? source : "unknown";
        String errorType = cause != null ? cause.getClass().getSimpleName() : "unknown";
        emit("error", Map.of("error.source", errorSource, "error.type", errorType));
    }

    /**
     * One span per chat-start failure — the user connected but could not get a working
     * chat going — classified into the four actionable types so SigNoz can segregate WHY:
     * <ul>
     *   <li>{@code guest_account_unavailable} — the visitor could not be given a guest
     *       account/session (provisioning / pool / IAM failed)</li>
     *   <li>{@code welcome_unavailable} — the Welcome Conversation could not run: it is not
     *       LIVE, or the account's role is not assigned to its topic/conversation. These two
     *       are indistinguishable in the guest's runtime context (both resolve to nothing),
     *       so they are reported as one reason; role-not-assigned is only reliably separable
     *       at setup time.</li>
     *   <li>{@code platform_error} — a platform / RPC call failed for another reason</li>
     * </ul>
     * These are distinct from token-auth failures ({@code auth.attempt}) — most happen
     * AFTER a successful login. {@code stage} is a coarse extra slice ({@code guest} at
     * login vs {@code welcome} at WS open). SigNoz:
     * {@code chatbot.operation='chat.start.failure'} → count(), group by
     * {@code chat.start.failure.reason}.
     */
    public static void recordChatStartFailure(String reason, String stage) {
        String failureReason = reason != null ? reason : "unknown";
        String failureStage = stage != null ? stage : "unknown";
        emit("chat.start.failure", Map.of(
                "chat.start.failure.reason", failureReason,
                "chat.start.failure.stage", failureStage));
    }

    // --------------------------------------------------- extra coverage (debugging)

    /**
     * REST/controller-layer span — one per API request, tagged with the endpoint. Reveals all
     * API traffic (e.g. whether {@code POST /session} is hit, or pooling bypasses it).
     */
    public static void recordApiRequest(String endpoint) {
        emit("api.request", Map.of("endpoint", endpoint != null ? endpoint : "unknown"));
    }

    /**
     * Welcome-trigger lifecycle span, tagged with the outcome
     * ({@code executed} / {@code message_shown} / {@code skipped_already_executed} /
     * {@code skipped_no_session} / {@code skipped_in_progress} / {@code error}). Tells us
     * definitively whether the welcome conversation ran, the static welcome message was
     * shown (no conversation configured), or the welcome was skipped on a given WS open.
     */
    public static void recordWelcome(String result) {
        emit("welcome", Map.of("welcome.result", result != null ? result : "unknown"));
    }

    /**
     * Inbox-listener span — fires when a message lands in the invoker inbox (the
     * conversation-output path, which may bypass {@code ChatBotMessageSender.sendMessages}).
     */
    public static void recordInboxMessage(String messageClass) {
        emit("inbox.message", Map.of("message.class", messageClass != null ? messageClass : "unknown"));
    }
}
