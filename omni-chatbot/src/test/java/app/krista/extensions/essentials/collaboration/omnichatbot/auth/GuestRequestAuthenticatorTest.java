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

import app.krista.extension.request.protos.http.HttpRequest;
import app.krista.ksdk.accounts.Account;
import app.krista.ksdk.accounts.AccountProvider;
import app.krista.ksdk.authentication.SessionManager;
import app.krista.ksdk.context.AuthorizationContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.net.URI;
import java.util.NoSuchElementException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link GuestRequestAuthenticator#getAuthenticatedAccountId} focused on the
 * account-revalidation branch that runs on {@code /authn/login}: a transient/unknown failure of
 * {@code accountProvider.getAccount} must NOT delete the session (returning user keeps it), while a
 * definitive {@link NoSuchElementException} (account deleted) MUST drop the stale session and fall
 * through to fresh-guest provisioning. Non-login requests keep the original strict behaviour.
 */
@DisplayName("GuestRequestAuthenticator — login account-revalidation")
class GuestRequestAuthenticatorTest {

    private static final String CLIENT_SESSION_ID = "cs-1";
    private static final String ACCOUNT_ID = "wsContact_acc1";

    @Mock private AuthorizationContext authorizationContext;
    @Mock private SessionManager sessionManager;
    @Mock private AccountProvider accountProvider;
    @Mock private AuthAccountManager authAccountManager;

    private GuestRequestAuthenticator authenticator;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        authenticator = new GuestRequestAuthenticator(authorizationContext, sessionManager,
                accountProvider, authAccountManager);
    }

    private HttpRequest requestFor(String path) {
        HttpRequest httpRequest = mock(HttpRequest.class);
        when(httpRequest.getUri()).thenReturn(URI.create("https://host" + path));
        when(httpRequest.getHeader(AuthConstants.COOKIE)).thenReturn(null);
        when(httpRequest.getHeader(AuthConstants.CHATBOT_SESSION_ID_HEADER)).thenReturn(CLIENT_SESSION_ID);
        return httpRequest;
    }

    private AuthenticationResponse cachedResponse() {
        return new AuthenticationResponse(CLIENT_SESSION_ID, null, null, ACCOUNT_ID,
                null, null, null, null, false, false, null, null);
    }

    @Test
    @DisplayName("login + transient getAccount failure: keeps session, returns existing accountId")
    void loginTransientFailureKeepsSession() {
        HttpRequest request = requestFor("/authn/login");
        when(authAccountManager.get(CLIENT_SESSION_ID)).thenReturn(cachedResponse());
        when(accountProvider.getAccount(ACCOUNT_ID)).thenThrow(new RuntimeException("appliance timeout"));

        String result = authenticator.getAuthenticatedAccountId(request);

        assertThat(result).isEqualTo(ACCOUNT_ID);
        verify(authAccountManager, never()).delete(CLIENT_SESSION_ID);
    }

    @Test
    @DisplayName("login + account deleted (NoSuchElement): drops session, falls through to fresh guest")
    void loginAccountDeletedDropsSession() {
        HttpRequest request = requestFor("/authn/login");
        when(authAccountManager.get(CLIENT_SESSION_ID)).thenReturn(cachedResponse());
        when(accountProvider.getAccount(ACCOUNT_ID)).thenThrow(new NoSuchElementException("gone"));
        when(authorizationContext.isAuthenticated()).thenReturn(false);

        String result = authenticator.getAuthenticatedAccountId(request);

        assertThat(result).isNull();
        verify(authAccountManager).delete(CLIENT_SESSION_ID);
    }

    @Test
    @DisplayName("login + valid account: returns accountId without touching the session")
    void loginValidAccountReturnsId() {
        HttpRequest request = requestFor("/authn/login");
        when(authAccountManager.get(CLIENT_SESSION_ID)).thenReturn(cachedResponse());
        when(accountProvider.getAccount(ACCOUNT_ID)).thenReturn(mock(Account.class));

        String result = authenticator.getAuthenticatedAccountId(request);

        assertThat(result).isEqualTo(ACCOUNT_ID);
        verify(authAccountManager, never()).delete(CLIENT_SESSION_ID);
    }

    @Test
    @DisplayName("non-login + transient getAccount failure: propagates, never deletes the session")
    void nonLoginTransientFailurePropagates() {
        HttpRequest request = requestFor("/authn/session");
        // Cache MISS so the non-login fast-path is skipped and getAccount is actually invoked.
        when(authAccountManager.get(CLIENT_SESSION_ID)).thenReturn(null);
        when(sessionManager.lookupAccountId(CLIENT_SESSION_ID)).thenReturn(ACCOUNT_ID);
        when(accountProvider.getAccount(ACCOUNT_ID)).thenThrow(new RuntimeException("appliance timeout"));

        assertThatThrownBy(() -> authenticator.getAuthenticatedAccountId(request))
                .isInstanceOf(IllegalStateException.class);
        verify(authAccountManager, never()).delete(CLIENT_SESSION_ID);
    }
}
