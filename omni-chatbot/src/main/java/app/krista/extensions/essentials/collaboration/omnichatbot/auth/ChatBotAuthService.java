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

import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.TimeUnit;
import javax.inject.Inject;
import javax.inject.Named;

import app.krista.extension.authorization.AuthorizationException;
import app.krista.extension.executor.Invoker;
import app.krista.extension.request.RoutingInfo;
import app.krista.extension.request.protos.http.HttpProtocol;
import app.krista.extension.util.InvokerAttributeProvider;
import app.krista.ksdk.accounts.Account;
import app.krista.ksdk.accounts.Person;
import app.krista.ksdk.authentication.AuthenticationSettings;
import app.krista.ksdk.authentication.SessionManager;
import app.krista.ksdk.authorization.Role;
import app.krista.ksdk.context.RuntimeContext;
import app.krista.omni.sdk.spi.impl.services.AccountService;
import app.krista.omni.sdk.spi.impl.util.Strings;
import com.google.gson.JsonObject;
import org.jvnet.hk2.annotations.Service;

import static javax.ws.rs.core.Cookie.DEFAULT_VERSION;

/**
 * Server-side helper that holds the auth-flow logic shared by the JAX-RS resource
 * ({@link ChatBotAuthResource}) and the warm pool ({@code ChatBotPool}). Keeping the
 * logic in an @Service lets the pool reuse it without dragging in JAX-RS plumbing.
 */
@Service
public final class ChatBotAuthService {

    private static final String EMAIL_PREFIX = "guest";
    private static final String UNDERSCORE = "_";

    private final SessionManager sessionManager;
    private final AccountProvisioner accountProvisioner;
    private final RuntimeContext runtimeContext;
    private final GuestAuthenticationRoleManager guestAuthenticationRoleProvisioner;
    private final AuthenticationSettings authenticationSettings;
    private final Invoker invoker;
    private final InvokerAttributeProvider<Double> sessionTimeout;
    private final AuthAccountManager authAccountManager;

    @Inject
    public ChatBotAuthService(SessionManager sessionManager,
            AccountProvisioner accountProvisioner, RuntimeContext runtimeContext,
            GuestAuthenticationRoleManager guestAuthenticationRoleProvisioner,
            AuthenticationSettings authenticationSettings, Invoker invoker,
            InvokerAttributeProvider<Double> sessionTimeout, AuthAccountManager authAccountManager) {
        this.sessionManager = sessionManager;
        this.accountProvisioner = accountProvisioner;
        this.runtimeContext = runtimeContext;
        this.guestAuthenticationRoleProvisioner = guestAuthenticationRoleProvisioner;
        this.authenticationSettings = authenticationSettings;
        this.invoker = invoker;
        this.sessionTimeout = sessionTimeout;
        this.authAccountManager = authAccountManager;
    }

    /**
     * Provisions a fresh guest account with the supplied
     * {@code defaultRoleName}, mints its JWT session, and registers the
     * resulting AuthenticationResponse in the auth-account cache. Callers
     * must resolve the role beforehand via
     * {@link AccountProvisioner#getDefaultRoleName()} or supply a
     * known value (e.g. the new role from the {@code INVOKER_UPDATED} hook).
     */
    public AuthenticationResponse provisionGuestSession(boolean isOmni, String defaultRoleName)
            throws AuthorizationException {
        String email = getEmail(isOmni);
        addDomainToWorkspaceIfNotPresent(email);
        Account account = accountProvisioner.provisionAccount(email, defaultRoleName);
        String sessionId = sessionManager.createSession(account.getAccountId());
        String runtimeAccountId = runtimeContext.getKristaAccount().getAccountId();
        AuthenticationResponse authenticationResponse = createAuthenticationResponse(account, sessionId,
                runtimeAccountId);
        authAccountManager.put(sessionId, authenticationResponse);
        return authenticationResponse;
    }

    /**
     * Mint a fresh JWT session + AuthenticationResponse for an ALREADY-EXISTING
     * workspace account. Used by the pool's orphan-adoption flow on chatbot
     * startup: when a previous chatbot invoker was removed without clean
     * deletion (framework race), this lets the new chatbot adopt those leftover
     * accounts into its pool instead of creating duplicates.
     *
     * <p>Skips {@code accountProvisioner.provisionAccount(...)} (which would
     * create a new appliance Account) and re-uses the supplied account.
     * Everything else mirrors {@link #provisionGuestSession(boolean)}.
     */
    public AuthenticationResponse adoptExistingAccount(Account account) throws AuthorizationException {
        if (account == null) {
            throw new IllegalStateException("adoptExistingAccount: account is null");
        }
        String sessionId = sessionManager.createSession(account.getAccountId());
        String runtimeAccountId = runtimeContext.getKristaAccount().getAccountId();
        AuthenticationResponse authenticationResponse = createAuthenticationResponse(account, sessionId,
                runtimeAccountId);
        authAccountManager.put(sessionId, authenticationResponse);
        return authenticationResponse;
    }

    public AuthAccountManager getAuthAccountManager() {
        return authAccountManager;
    }

    public AccountProvisioner getAccountProvisioner() {
        return accountProvisioner;
    }

    public SessionManager getSessionManager() {
        return sessionManager;
    }

    public RuntimeContext getRuntimeContext() {
        return runtimeContext;
    }

    public String getEmail(boolean isOmni) {
        return EMAIL_PREFIX + UNDERSCORE + UUID.randomUUID() + Strings.AT
                + (isOmni ? AccountService.SUPPORTED_DOMAIN : EmailAddresses.DEFAULT_DOMAIN);
    }

    public URI resolveCallerUri(String callerUri) throws URISyntaxException {
        if (!Objects.isNull(callerUri) && !callerUri.isBlank()) {
            return new URI(callerUri);
        }
        return new URI(invoker.getRoutingInfo().getRoutingURL(HttpProtocol.PROTOCOL_NAME, RoutingInfo.Type.APPLIANCE));
    }

    public String getCookiePath(URI httpURI) {
        String path = httpURI.getPath();
        String[] parts = path.split("/");
        int len = parts.length;
        return "/" + parts[len - 3] + "/" + parts[len - 2] + "/" + parts[len - 1];
    }

    public int getMaxAgeInSeconds() {
        Double sessionTimeOut = sessionTimeout.get();
        if (sessionTimeOut == null) {
            return 24 * 60 * 60;
        }
        long timeout = (long) sessionTimeOut.doubleValue();
        return (int) TimeUnit.MINUTES.toSeconds(timeout);
    }

    public String getEncodedClientSessionId(String sessionId) {
        JsonObject jsonObject = new JsonObject();
        jsonObject.addProperty("clientSessionId", sessionId);
        return URLEncoder.encode(jsonObject.toString(), StandardCharsets.UTF_8);
    }

    public String createCookieString(String cookieName, String cookieValue, String path,
            String domain, int maxAge, String expires) {
        return cookieName + "=" + cookieValue + "; "
                + "Version=" + DEFAULT_VERSION + "; "
                + "Comment=" + AuthConstants.COMMENT + "; "
                + "Path=" + path + "; "
                + "Domain=" + domain + "; "
                + "Max-Age=" + maxAge + "; "
                + "Expires=" + expires + "; "
                + "Secure; HttpOnly; SameSite=None;";
    }

    public String createExpiredCookie(String cookieName, String path, String domain) {
        return createCookieString(cookieName, "", path, domain, 0, "Thu, 01 Jan 1970 00:00:00 GMT");
    }

    private void addDomainToWorkspaceIfNotPresent(String email) throws AuthorizationException {
        List<String> supportedDomainsForWorkspace = authenticationSettings.getSupportedDomains();
        String supportedDomain = String.join(",", supportedDomainsForWorkspace);
        String invokerDomains = EmailAddresses.getDomainName(email);
        CommonUtils.validateIfSupportedDomain(email, supportedDomain, invokerDomains);
        CommonUtils.addSupportedDomainsToWorkspace(email, supportedDomainsForWorkspace, authenticationSettings);
    }

    private AuthenticationResponse createAuthenticationResponse(Account account, String sessionId,
            String runtimeAccountId) throws AuthorizationException {
        Person person = account.getPerson();
        Map<String, Object> extras = new HashMap<>();
        extras.put("creationTime", getCurrentDateTime());
        extras.put("newSession", true);
        return new AuthenticationResponse(sessionId, person.getPersonName(), person.getAvatarUrl(),
                account.getAccountId(), runtimeAccountId, person.getPersonId(), getListOfRoles(account.getRoles()),
                account.getInboxId(), guestAuthenticationRoleProvisioner.hasAdminRole(account), false,
                Map.of("email", account.getPrimaryEmailAddress()), extras);
    }

    private List<String> getListOfRoles(Set<Role> roles) {
        List<String> allRoles = new ArrayList<>();
        for (Role role : roles) {
            allRoles.add(role.getRoleId());
        }
        return allRoles;
    }

    private String getCurrentDateTime() {
        DateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss Z");
        dateFormat.setTimeZone(TimeZone.getTimeZone("GMT"));
        return dateFormat.format(Calendar.getInstance().getTime());
    }

}
