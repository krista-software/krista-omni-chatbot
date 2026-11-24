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

import app.krista.extension.request.protos.http.HttpRequest;
import app.krista.extension.request.protos.ws.WsConnectionOpened;
import app.krista.extension.request.protos.ws.WsEvent;
import app.krista.extension.util.InvokerAttributeProvider;
import app.krista.extension.util.ServiceRegistry;
import app.krista.extensions.essentials.collaboration.omnichatbot.audit.AuditService;
import app.krista.extensions.essentials.collaboration.omnichatbot.concurrency.ConcurrencyManager;
import app.krista.extensions.essentials.collaboration.omnichatbot.contants.Constants;
import app.krista.extensions.essentials.collaboration.omnichatbot.metrics.ChatBotMetrics;
import app.krista.extensions.essentials.collaboration.omnichatbot.resource.dto.NotificationMessage;
import app.krista.extensions.essentials.collaboration.omnichatbot.resource.dto.SessionDto;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.impl.WsConnectionStore;
import app.krista.extensions.essentials.collaboration.omnichatbot.service.ws.WsEventHandler;
import app.krista.extensions.essentials.collaboration.omnichatbot.store.ConnectionStore;
import app.krista.extensions.essentials.collaboration.omnichatbot.utils.ChatBotUtil;
import app.krista.extensions.util.KeyValueStore;
import app.krista.extensions.essentials.collaboration.omnichatbot.store.SessionStore;
import app.krista.ksdk.context.AuthorizationContext;
import app.krista.ksdk.context.RequestContext;
import app.krista.ksdk.notifications.Notification;
import app.krista.model.field.util.GsonJsonMapper;
import app.krista.omni.sdk.medium.api.dto.MessageDto;
import app.krista.omni.sdk.medium.api.dto.Sender;
import app.krista.omni.sdk.medium.interactive.InteractiveMediumService;
import app.krista.omni.sdk.spi.impl.OmniChannelSession;
import app.krista.omni.sdk.spi.impl.services.SessionKeyGenerator;
import com.kristasoft.common.holders.ThreadLocalProxy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Handler for WebSocket connection opened events.
 *
 * <p>This handler is invoked when a WebSocket connection is successfully established.
 * It validates the user's authorization, stores the connection, auto-triggers the
 * configured welcome conversation (eliminating a frontend handshake round-trip),
 * and sends a ConnectionEstablished notification to the client.
 */
public class WsConnectionOpenedHandler implements WsEventHandler {

    private final GsonJsonMapper gsonJsonMapper = GsonJsonMapper.getInstance();
    private static final Logger LOGGER = LoggerFactory.getLogger(WsConnectionOpenedHandler.class);
    private final ConnectionStore connectionStore;
    private final InteractiveMediumService mediumService;
    private final InvokerAttributeProvider<String> welcomeConversationProvider;
    private final SessionStore sessionStore;
    private final ConcurrencyManager concurrencyManager;
    // uiConfigJson lives in the KeyValueStore (written synchronously by the Integration
    // Settings save) — the single source of truth — so the admin's "fallbackMessage"/
    // "botName" are picked up reliably without a reload.
    private final KeyValueStore keyValueStore;
    private final AuditService auditService;

    // Synthetic sender id for the fallback bubble. Any value other than the end
    // user's account id makes the frontend render it as an incoming (bot) message;
    // the bot label comes from the sender name (configured botName).
    private static final String FALLBACK_SENDER_ID = "krista";
    private static final String DEFAULT_BOT_NAME = "Krista";

    public WsConnectionOpenedHandler(ConnectionStore connectionStore,
            InteractiveMediumService mediumService,
            InvokerAttributeProvider<String> welcomeConversationProvider,
            SessionStore sessionStore,
            ConcurrencyManager concurrencyManager,
            KeyValueStore keyValueStore,
            AuditService auditService) {
        this.connectionStore = connectionStore;
        this.mediumService = mediumService;
        this.welcomeConversationProvider = welcomeConversationProvider;
        this.sessionStore = sessionStore;
        this.concurrencyManager = concurrencyManager;
        this.keyValueStore = keyValueStore;
        this.auditService = auditService;
    }

    @Override
    public void handle(AuthorizationContext authorizationContext, WsEvent wsEvent) throws IOException {
        // Telemetry only — count every WS connection open at the TOP, BEFORE the isAuthenticated
        // gate below, so an open whose auth context isn't resolved at handle-time is still counted
        // (account id best-effort). No functional change.
        ChatBotMetrics.recordConnectionOpened(
                authorizationContext.isAuthenticated() && authorizationContext.getAuthorizedAccount() != null
                        ? authorizationContext.getAuthorizedAccount().getAccountId() : null);
        if (authorizationContext.isAuthenticated()) {
            String accountId = authorizationContext.getAuthorizedAccount().getAccountId();
            String connectionId = wsEvent.getConnection().getConnectionId();
            LOGGER.warn("User is authorized with accountId: {} and connectionId: {}", accountId, connectionId);
            wsEvent.getConnection().setAutoPong(true);
            // Connection authorization was already saved by the authenticate(...) call site below
            // during the framework auth filter pass (ChatBotAuthenticator.handleWsEvent invokes
            // WsConnectionOpenedHandler.authenticate before this handler runs). Saving again here
            // was a redundant Infinispan-cache write on every WS open.
            this.connectionStore.put(accountId, connectionId);
            // Acquire (or re-acquire after a grace-period reconnect) an active,
            // ref-counted concurrency slot. No-op unless the feature flag is enabled.
            concurrencyManager.onWsOpened(accountId);
            auditService.recordWsConnected();
            // Seed the live-presence heartbeat immediately so a just-connected user
            // is counted before their first ping arrives.
            auditService.recordPresence(accountId);

            Notification notification = new Notification("ConnectionEstablished", System.currentTimeMillis(), Map.of());
            wsEvent.getConnection().sendTextMessage(gsonJsonMapper.toString(new NotificationMessage("notification", notification)));

            // Apply the user's language and refresh the session timestamp BEFORE
            // running the welcome conversation, so the conversation engine sees the
            // user's locale on its very first reply. The frontend appends ?lang=<code>
            // to the WS URL — we read it here off the upgrade request, no new round-trip.
            //
            // This also fixes the pool-entry case (sessions were pre-warmed in "en" and
            // had a future-dated timestamp): the single call resets both to the active
            // user's context.
            String languageCode = extractLanguageCode(wsEvent);
            applyUserLanguageAndRefreshTimestamp(accountId, languageCode);

            triggerWelcomeConversation(wsEvent, accountId);
        } else {
            LOGGER.warn("#####-CHATBOT- USER IS NOT AUTHENTICATED, CAN NOT OPEN, CLOSING CONNECTION: {}", wsEvent.getConnection().getConnectionId());
            wsEvent.getConnection().close(1008, "User is not Authorised, can not open");
        }
    }

    /**
     * Synchronously updates the OmniChannelSession's language to the user's chosen
     * code AND refreshes its lastMessageReceivedTime to "now".
     *
     * <p>Implementation note: we load + mutate + save the {@link OmniChannelSession}
     * directly via {@link app.krista.omni.sdk.spi.impl.store.SessionStore} instead of
     * calling {@code mediumService.getAuthenticatedAccount(messageIn, languageCode)}.
     * The framework's {@code OmniChannelSessionManager.getOmniChannelSession(messageIn,
     * languageCode)} only applies the language code when CREATING a new session — for
     * an already-existing session (the pool-pop case) the language argument is
     * silently dropped. Bypassing the indirection lets us actually set the language
     * on the existing session.
     *
     * <p><b>Why sync, not async:</b> the welcome conversation that runs immediately
     * after this method reads the session's language to localize its first reply. A
     * background thread could let the conversation engine observe the stale "en" the
     * session was pre-warmed with. The Infinispan round-trip is a few ms — negligible
     * vs the WS handshake itself.
     *
     * @param accountId    the authorized account driving this WS connection
     * @param languageCode the user's chosen language code (from {@code ?lang=} on the
     *                     WS upgrade URL), or {@code "en"} when absent
     */
    private void applyUserLanguageAndRefreshTimestamp(String accountId, String languageCode) {
        try {
            RequestContext requestContext = ThreadLocalProxy.getThreadLocal(RequestContext.class).get();
            if (requestContext == null) {
                LOGGER.warn("#####-CHATBOT-WS-OPEN: no RequestContext on thread for accountId={}", accountId);
                return;
            }
            String sessionKey = new SessionKeyGenerator().generate(
                    accountId, requestContext.getInvokerId(), requestContext.getExecutionMode());
            app.krista.omni.sdk.spi.impl.store.SessionStore omniSessionStore =
                    app.krista.omni.sdk.spi.impl.store.SessionStore.create(ServiceRegistry.getInstance());
            OmniChannelSession session = omniSessionStore.loadSession(sessionKey);
            if (session == null) {
                LOGGER.warn("#####-CHATBOT-WS-OPEN: session not found for accountId={} sessionKey={}",
                        accountId, sessionKey);
                return;
            }
            session.setSessionDefaultLanguageCode(languageCode);
            session.setLastMessageReceivedTime(System.currentTimeMillis());
            omniSessionStore.saveSession(session);
        } catch (Exception cause) {
            LOGGER.warn("#####-CHATBOT-Failed to apply language/refresh timestamp for accountId={} lang={}",
                    accountId, languageCode, cause);
        }
    }

    /**
     * Reads the {@code lang} query parameter off the WS upgrade HTTP request. The
     * frontend appends {@code ?lang=<code>} to the WS URL; falling back to
     * {@code "en"} when the param is absent, blank, or the event isn't a
     * {@link WsConnectionOpened} (defensive — current call site only invokes us on
     * connection-opened events, but the cast guard keeps this method safe to reuse).
     */
    private static String extractLanguageCode(WsEvent wsEvent) {
        if (!(wsEvent instanceof WsConnectionOpened opened)) {
            return "en";
        }
        HttpRequest httpRequest = opened.getHttpRequest();
        if (httpRequest == null || httpRequest.getUri() == null) {
            return "en";
        }
        String query = httpRequest.getUri().getQuery();
        if (query == null || query.isEmpty()) {
            return "en";
        }
        for (String pair : query.split("&")) {
            int eq = pair.indexOf('=');
            if (eq > 0 && "lang".equals(pair.substring(0, eq))) {
                try {
                    String value = URLDecoder.decode(pair.substring(eq + 1), StandardCharsets.UTF_8);
                    return value.isBlank() ? "en" : value;
                } catch (Exception cause) {
                    LOGGER.warn("#####-CHATBOT-Failed to URL-decode ?lang= value; falling back to 'en'", cause);
                    return "en";
                }
            }
        }
        return "en";
    }

    // Runs the configured welcome conversation as soon as the WS connection
    // is established, without waiting for the frontend to send a "welcome"
    // payload. One-shot per SUCCESSFUL execution, per SESSION (not per WS
    // connection) — once the welcome has actually run, a WS reconnect for the
    // same session (network drop, page refresh, etc.) must NOT re-run it,
    // otherwise an in-progress user conversation gets a stray welcome firing
    // on top of it. Tracked via SessionDto.welcomeExecuted in the persistent
    // SessionStore so the gate survives both WS disconnects and JVM restarts.
    // A welcome that could NOT run leaves the gate open so a later connect
    // retries (see the success branch below for why). WelcomeExecutionTracker
    // is kept as an in-process race guard between this auto-trigger and the
    // legacy payload handler racing the same SessionDto load; it is cleared on
    // connection close, so it never blocks a retry on a later connection.
    private void triggerWelcomeConversation(WsEvent wsEvent, String accountId) {
        try {
            SessionDto sessionDto = sessionStore.get(accountId);
            if (Objects.isNull(sessionDto) || sessionDto.getSessionInboxId() == null) {
                LOGGER.warn("#####-CHATBOT-No session/inbox for accountId {}; skipping welcome auto-trigger", accountId);
                ChatBotMetrics.recordWelcome("skipped_no_session");
                return;
            }
            if (sessionDto.isWelcomeExecuted()) {
                // Welcome conversation already ran for this session — this is a WS
                // reconnect. Skip silently so any in-progress user conversation is
                // not disrupted.
                ChatBotMetrics.recordWelcome("skipped_already_executed");
                return;
            }
            String inboxId = sessionDto.getSessionInboxId();
            String welcomeConversationName = welcomeConversationProvider.get();
            if (welcomeConversationName == null || welcomeConversationName.isBlank()) {
                // No Welcome Conversation configured — the Welcome Message is the greeting.
                // Push the admin-configured message (or the built-in default) as a normal bot
                // bubble, and flip the one-shot gate so a reconnect never re-pushes it. A static
                // message always "succeeds", so (unlike the conversation-failure fallback) it is
                // safe to mark the session welcomed here.
                String welcomeMessage = readUiConfigValue("welcomeMessage", Constants.DEFAULT_WELCOME_MESSAGE);
                pushWelcomeMessage(wsEvent, inboxId, welcomeMessage);
                sessionDto.setWelcomeExecuted(true);
                sessionStore.put(accountId, sessionDto);
                ChatBotMetrics.recordWelcome("message_shown");
                return;
            }
            if (!WelcomeExecutionTracker.tryStart(inboxId)) {
                ChatBotMetrics.recordWelcome("skipped_in_progress");
                return;
            }
            // Run the welcome by its currently-configured name, resolved inside the user's
            // own session. We pass a NULL conversation id to executeConversationById: that runs
            // the exact same by-name resolution as executeConversation (so the current
            // configuration is always honoured — no stale id cached/reused across appliance
            // nodes), but it RETURNS the resolved conversation id, or null when the welcome
            // could not run. Every failure path below goes through failChatStart(...), so the
            // metric and the user-visible fallback are ALWAYS emitted together — they can never
            // diverge.
            try {
                String executedId = mediumService.executeConversationById(inboxId, null, welcomeConversationName);
                if (executedId != null) {
                    ChatBotMetrics.recordWelcome("executed");
                    // Flip the one-shot gate ONLY on a SUCCESSFUL launch, so a reconnect never
                    // re-runs the welcome on top of an in-progress conversation.
                    //
                    // A FAILED welcome deliberately leaves the flag false so the next connect
                    // retries. The SDK returns null for BOTH a config problem (conversation not
                    // LIVE / role has no access) AND a session-resolution failure
                    // (OmniChannelServiceImpl.executeByName -> resolveSession), so null must not
                    // be treated as permanently terminal: the conversation may since have been
                    // published (DRAFT -> LIVE), or the transient failure may have cleared.
                    // Marking it executed here would pin the session to the fallback for its
                    // entire lifetime (sessions live for days) with no recovery path.
                    // Repeated fallback bubbles are not a concern — pushFallbackMessage uses a
                    // deterministic per-session message id that the frontend de-duplicates on.
                    sessionDto.setWelcomeExecuted(true);
                    sessionStore.put(accountId, sessionDto);
                } else {
                    // The welcome could not run. In the guest's runtime context the platform
                    // filters conversation lookups by access, so "not live" and "the role is
                    // not assigned to the topic/conversation" are INDISTINGUISHABLE here — both
                    // resolve to nothing. Report them as one honest reason rather than guessing;
                    // role-not-assigned is only reliably separable at setup time (admin context).
                    failChatStart(wsEvent, inboxId, "welcome_unavailable");
                }
            } catch (Exception welcomeError) {
                // A platform / RPC call failed while launching the welcome. inboxId is known
                // here, so record AND show the fallback (via failChatStart) — the user is not
                // left stuck and the metric stays consistent with the fallback.
                ChatBotMetrics.recordWelcome("error");
                failChatStart(wsEvent, inboxId, "platform_error");
                LOGGER.warn("#####-CHATBOT-Welcome launch failed for inboxId {}", inboxId, welcomeError);
            }
        } catch (Exception cause) {
            // Failure BEFORE the welcome launch (e.g. loading the session) — the inbox is
            // unknown here, so a targeted fallback cannot be shown; record the outcome only.
            ChatBotMetrics.recordWelcome("error");
            LOGGER.warn("#####-CHATBOT-Failed to auto-trigger welcome conversation for accountId {}", accountId, cause);
        }
    }

    /**
     * Fails chat start CONSISTENTLY: records the classified {@code chat.start.failure} metric
     * AND shows the fallback message, always together and in that order, so the telemetry can
     * never diverge from what the user sees. (Span export is best-effort — but
     * {@code recordChatStartFailure} also logs via SLF4J regardless, so the EP log is the
     * reliable record whenever a fallback is shown.)
     */
    private void failChatStart(WsEvent wsEvent, String inboxId, String reason) {
        ChatBotMetrics.recordChatStartFailure(reason, "welcome");
        // Read the configured fallback only now that the welcome has actually failed —
        // the healthy path never reads it.
        String fallbackMessage = readUiConfigValue("fallbackMessage", Constants.DEFAULT_FALLBACK_MESSAGE);
        pushFallbackMessage(wsEvent, inboxId, fallbackMessage);
    }

    /**
     * Pushes the admin-configured fallback message (KR-21127) shown when the Welcome
     * Conversation can't run. Sent straight down the just-opened connection so the
     * frontend renders it and clears the welcome loader.
     */
    private void pushFallbackMessage(WsEvent wsEvent, String inboxId, String text) {
        pushBotMessage(wsEvent, inboxId, text, fallbackMessageId(inboxId));
    }

    /**
     * Pushes the Welcome Message greeting shown on chat start when no Welcome
     * Conversation is configured (the backend owns the welcome message so the default
     * and the "empty → default" behaviour live in one place).
     */
    private void pushWelcomeMessage(WsEvent wsEvent, String inboxId, String text) {
        pushBotMessage(wsEvent, inboxId, text, welcomeMessageId(inboxId));
    }

    /**
     * Sends {@code text} down the just-opened connection as a normal incoming (bot) text
     * message (same node, same route as the ConnectionEstablished notification above),
     * matching the {@code NewMessages} envelope {@code ChatBotMessageSender} normally
     * produces. No-op on a blank message. The stable {@code messageId} lets the frontend
     * de-duplicate repeats across reconnects.
     */
    private void pushBotMessage(WsEvent wsEvent, String inboxId, String text, String messageId) {
        if (text == null || text.isBlank()) {
            return;
        }
        try {
            long now = System.currentTimeMillis();
            String botName = readUiConfigValue("botName", DEFAULT_BOT_NAME);
            MessageDto messageDto = new MessageDto(
                    messageId, null, inboxId,
                    new Sender(FALLBACK_SENDER_ID, botName),
                    text, null, now, null, null, MessageDto.TYPE_INFORM);
            Map<String, Object> payload = new HashMap<>();
            payload.put("inboxId", inboxId);
            payload.put("messages", List.of(messageDto));
            Notification notification = new Notification("NewMessages", now, payload);
            wsEvent.getConnection().sendTextMessage(
                    gsonJsonMapper.toString(new NotificationMessage("notification", notification)));
        } catch (Exception cause) {
            LOGGER.warn("#####-CHATBOT-Failed to push bot message for inboxId {}", inboxId, cause);
        }
    }

    /**
     * Stable, per-session id for the fallback bubble.
     *
     * <p>Because a failed welcome no longer flips {@code welcomeExecuted}, every reconnect
     * retries and can push the fallback again. The frontend de-duplicates incoming messages
     * by id ({@code ChatFacade.handleIncomingMessages} skips ids already in the timeline), so
     * deriving the id from the session inbox collapses those repeats into a single bubble for
     * the lifetime of a page session. After a refresh the timeline starts empty, so the
     * fallback correctly renders again — which is what we want, since it is never persisted.
     */
    private static String fallbackMessageId(String inboxId) {
        return UUID.nameUUIDFromBytes(("chatbot-welcome-fallback:" + inboxId)
                .getBytes(StandardCharsets.UTF_8)).toString();
    }

    /**
     * Stable, per-session id for the welcome-message bubble. Distinct from the fallback id
     * so the two never de-duplicate against each other; derived from the session inbox so
     * reconnects collapse to a single bubble while a post-refresh empty timeline renders it
     * again (it is never persisted).
     */
    private static String welcomeMessageId(String inboxId) {
        return UUID.nameUUIDFromBytes(("chatbot-welcome-message:" + inboxId)
                .getBytes(StandardCharsets.UTF_8)).toString();
    }

    /**
     * Reads a String value from the invoker's {@code uiConfigJson} map (Integration
     * Settings), via the same {@link InvokerAttributeProvider} mechanism this handler
     * already uses for the welcome conversation. Defensive: a missing key, wrong type,
     * blank value, or unparseable JSON returns {@code defaultValue} and never throws.
     */
    private String readUiConfigValue(String key, String defaultValue) {
        try {
            String json = readUiConfigJson();
            if (json == null || json.isBlank()) {
                return defaultValue;
            }
            Object value = ChatBotUtil.getConfigMap(json).get(key);
            if (value instanceof String text && !text.isBlank()) {
                return text.trim();
            }
        } catch (Exception cause) {
            LOGGER.warn("#####-CHATBOT-Failed reading uiConfig '{}'; using default: {}", key, cause.getMessage());
        }
        return defaultValue;
    }

    /**
     * Reads the raw {@code uiConfigJson} string from the KeyValueStore — the single
     * source of truth the Integration Settings save writes synchronously.
     */
    private String readUiConfigJson() {
        Object stored = keyValueStore.get(Constants.UI_CONFIG_JSON);
        return stored != null ? stored.toString() : null;
    }

    @Override
    public String authenticate(String accountId, WsEvent wsEvent) {
        String accountIdByWsConnectionId = WsConnectionStore.getAccountIdByWsConnectionId(wsEvent.getConnection().getConnectionId());
        if (Objects.isNull(accountIdByWsConnectionId) && !Objects.isNull(accountId)) {
            LOGGER.warn("Authorization successful for accountId: {} and connectionId: {}", accountId, wsEvent.getConnection().getConnectionId());
            WsConnectionStore.saveConnectionAuthorization(wsEvent.getConnection(), accountId);
            return accountId;
        }
        return accountIdByWsConnectionId;
    }

}
