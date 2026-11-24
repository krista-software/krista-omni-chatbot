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

package app.krista.extensions.essentials.collaboration.omnichatbot.auth;

import app.krista.model.field.util.GsonJsonMapper;

public final class AuthConstants {

    private AuthConstants() {
        throw new IllegalStateException("Invalid access to utility class");
    }

    public static final GsonJsonMapper GSON_JSON_MAPPER = GsonJsonMapper.create();
    public static final String DEFAULT_ROLE_FOR_NEW_ACCOUNT = "Krista Guest User";
    public static final String AUTHENTICATION_TYPE = "Guest Authentication";
    public static final String DEFAULT_ROLE_KEY = "default_role";
    public static final String ATTRIBUTE_PARAMETERS = "attribute_parameters";

    // Marker attribute set on every chatbot-created account via
    // AccountProvisioner. Composite value:
    //
    //   KRISTA_SOURCE_OMNI_CHATBOT_PREFIX + invokerId
    //   e.g. "Omni Chatbot|INV_8f8b429b-...-b247c64e008a"
    //
    // The "Omni Chatbot" prefix identifies the account as chatbot-created (for
    // mediumService.deleteAccounts() filtering and adoption-scan filtering).
    // The "|<invokerId>" suffix tags the owner so future chatbot invokers can
    // tell their accounts apart from siblings/orphans during adoption.
    //
    // We encode the owner inside KRISTA_SOURCE instead of as a separate custom
    // attribute (OWNER_INVOKER_ID) to avoid creating a new workspace-level
    // DefnUserAttribute definition. The framework's createAttributesIfNotExist
    // path has a check-then-create race that lets multiple definitions slip in
    // for the same attribute name when concurrent account creations happen
    // before the definition exists — those duplicate definitions then cause
    // every later account to carry two attribute records with the same name
    // (the "OWNER_INVOKER_ID: INV_x, OWNER_INVOKER_ID: INV_x" symptom).
    // KRISTA_SOURCE has been registered in workspaces for a long time, so its
    // DefnUserAttribute exists exactly once and updates don't race.
    public static final String KRISTA_SOURCE_KEY = "KRISTA_SOURCE";
    public static final String KRISTA_SOURCE_OMNI_CHATBOT = "Omni Chatbot";
    public static final String KRISTA_SOURCE_OMNI_CHATBOT_PREFIX = KRISTA_SOURCE_OMNI_CHATBOT + "|";

    // Matches app.krista.extension.executor.dummy.DummyInvoker.INVOKER_ID — the
    // framework injects a DummyInvoker for @Named bindings (e.g. "Authentication")
    // when no real invoker is bound, so the injected field is never null. Compare
    // against this id to detect the "no real binding" case before reading
    // attributes off the bound invoker.
    public static final String DUMMY_INVOKER_ID = "INV_dummy";

    public static final String CHATBOT_SESSION_ID_HEADER = "Chatbot-Session-Id";
    public static final String SOURCE = "source";
    public static final String CHATBOT_SESSION_ID = "chatbotSessionId";
    // Query-parameter fallback for the session id on WebSocket upgrades: browsers
    // cannot set custom headers on a WS upgrade, and the session cookie is
    // third-party (blockable by Safari ITP / Chrome cookie phase-out) in embedded
    // contexts. Same convention as the platform's media URLs (?clientSessionId=...).
    public static final String CLIENT_SESSION_ID_QUERY_PARAM = "clientSessionId";
    public static final String X_KRISTA_CONTEXT = "X-Krista-Context";
    public static final String COMMENT = "comment";
    public static final String COOKIE = "Cookie";
    public static final String CALLER_URI = "caller_uri";

}
