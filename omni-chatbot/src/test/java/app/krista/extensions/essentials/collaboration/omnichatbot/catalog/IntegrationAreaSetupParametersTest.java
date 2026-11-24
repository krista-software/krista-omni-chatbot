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

package app.krista.extensions.essentials.collaboration.omnichatbot.catalog;

import app.krista.extension.executor.ExtensionResponse;
import app.krista.extension.executor.Invoker;
import app.krista.extensions.essentials.collaboration.omnichatbot.ChatBotExtension;
import app.krista.extensions.essentials.collaboration.omnichatbot.auth.AuthConstants;
import app.krista.extensions.essentials.collaboration.omnichatbot.contants.Constants;
import app.krista.ksdk.accounts.AccountProvider;
import app.krista.ksdk.context.AuthorizationContext;
import app.krista.ksdk.inboxes.InboxManager;
import app.krista.ksdk.invoker.InvokerConfiguration;
import app.krista.omni.sdk.medium.interactive.InteractiveMediumService;
import app.krista.omni.sdk.medium.text.util.CommonInvokerParameters;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link IntegrationArea#setSetupParameters}.
 *
 * <p>The behaviour that matters here is not "does it save" but <em>what it sends for the arguments
 * the caller did not supply</em>. The request patches the invoker: omitted optional parameters must
 * keep their stored value, and an omitted "Trust Extension" must arrive at the platform as
 * {@code null} rather than {@code false} — sending {@code false} would revoke the invoker's
 * workspace-admin rights and restart it, breaking guest login for anyone who merely wanted to change
 * the welcome conversation. These tests pin that contract.
 */
@DisplayName("IntegrationArea — Set Setup Parameters")
class IntegrationAreaSetupParametersTest {

    private static final String WORKSPACE_ID = "ws_default";
    private static final String INVOKER_ID = "INV_test";
    private static final String STORED_WELCOME = "Old Welcome";
    private static final String STORED_FALLBACK = "Old Fallback";
    private static final String STORED_ROLE = "Old Role";

    private Invoker invoker;
    private ChatBotExtension chatBotExtension;
    private InvokerConfiguration invokerConfiguration;
    private MockedStatic<InteractiveMediumService> staticMediumService;

    private IntegrationArea area;

    @BeforeEach
    void setUp() {
        invoker = mock(Invoker.class);
        chatBotExtension = mock(ChatBotExtension.class);
        invokerConfiguration = mock(InvokerConfiguration.class);

        when(invoker.getWorkspaceId()).thenReturn(WORKSPACE_ID);
        when(invoker.getInvokerId()).thenReturn(INVOKER_ID);
        Map<String, Object> stored = new HashMap<>();
        stored.put(Constants.WELCOME_CONVERSATION_NAME, STORED_WELCOME);
        stored.put(CommonInvokerParameters.FALLBACK_CONVERSATION, STORED_FALLBACK);
        stored.put(AuthConstants.DEFAULT_ROLE_KEY, STORED_ROLE);
        when(invoker.getAttributes()).thenReturn(stored);

        when(invokerConfiguration.saveChanges(anyString(), anyString(), any(), anyString(), anyBoolean(), any()))
                .thenReturn(true);

        // The constructor calls InteractiveMediumService.getInstance(), which needs a live
        // RequestContext (absent in a unit test) — stub it during construction.
        staticMediumService = mockStatic(InteractiveMediumService.class);
        staticMediumService.when(InteractiveMediumService::getInstance)
                .thenReturn(mock(InteractiveMediumService.class));

        area = new IntegrationArea(invoker, mock(AuthorizationContext.class), mock(InboxManager.class),
                mock(AccountProvider.class), chatBotExtension, invokerConfiguration);
    }

    @AfterEach
    void tearDown() {
        staticMediumService.close();
    }

    private ExtensionResponse call(String welcome, String fallback, Double timeout, String role,
            String attributeParameters, Boolean trustExtension) {
        return area.setSetupParameters(welcome, fallback, timeout, role, attributeParameters, trustExtension);
    }

    private Map<String, Object> capturedAttributes() {
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> captor = ArgumentCaptor.forClass(Map.class);
        verify(invokerConfiguration).saveChanges(anyString(), anyString(), captor.capture(), anyString(),
                anyBoolean(), any());
        return captor.getValue();
    }

    private Boolean capturedTrustExtension() {
        ArgumentCaptor<Boolean> captor = ArgumentCaptor.forClass(Boolean.class);
        verify(invokerConfiguration).saveChanges(anyString(), anyString(), any(), anyString(), anyBoolean(),
                captor.capture());
        return captor.getValue();
    }

    @Test
    @DisplayName("omitted Trust Extension is sent as null so stored rights are left untouched")
    void omittedTrustExtension_isSentAsNull() {
        ExtensionResponse response = call("New Welcome", null, null, null, null, null);

        assertThat(response.getResult()).isEqualTo(ExtensionResponse.Result.SUCCESS);
        // Must be null, NOT false: false would differ from a stored true, revoking trust and
        // restarting the invoker as a side effect of an unrelated edit.
        assertThat(capturedTrustExtension()).isNull();
    }

    @Test
    @DisplayName("Trust Extension true is passed through")
    void trustExtensionTrue_isPassedThrough() {
        call("New Welcome", null, null, null, null, Boolean.TRUE);

        assertThat(capturedTrustExtension()).isTrue();
    }

    @Test
    @DisplayName("Trust Extension false is passed through and not confused with 'unset'")
    void trustExtensionFalse_isPassedThrough() {
        call("New Welcome", null, null, null, null, Boolean.FALSE);

        assertThat(capturedTrustExtension()).isFalse();
    }

    @Test
    @DisplayName("omitted optional parameters keep their stored values")
    void omittedOptionalParameters_keepStoredValues() {
        call("New Welcome", null, null, null, null, null);

        Map<String, Object> saved = capturedAttributes();
        assertThat(saved.get(Constants.WELCOME_CONVERSATION_NAME)).isEqualTo("New Welcome");
        assertThat(saved.get(CommonInvokerParameters.FALLBACK_CONVERSATION)).isEqualTo(STORED_FALLBACK);
        assertThat(saved.get(AuthConstants.DEFAULT_ROLE_KEY)).isEqualTo(STORED_ROLE);
    }

    @Test
    @DisplayName("supplied parameters are merged, and session timeout is stored as a Double")
    void suppliedParameters_areMerged() {
        call("New Welcome", "New Fallback", 45.0, "New Role", "{}", null);

        Map<String, Object> saved = capturedAttributes();
        assertThat(saved.get(Constants.WELCOME_CONVERSATION_NAME)).isEqualTo("New Welcome");
        assertThat(saved.get(CommonInvokerParameters.FALLBACK_CONVERSATION)).isEqualTo("New Fallback");
        assertThat(saved.get(AuthConstants.DEFAULT_ROLE_KEY)).isEqualTo("New Role");
        assertThat(saved.get(AuthConstants.ATTRIBUTE_PARAMETERS)).isEqualTo("{}");
        // The omni SDK reads this attribute behind an "instanceof Double" check and silently falls
        // back to the default timeout for any other numeric type.
        assertThat(saved.get(CommonInvokerParameters.SESSION_TIMEOUT)).isInstanceOf(Double.class).isEqualTo(45.0);
    }

    @Test
    @DisplayName("the invoker's own attribute map is never mutated")
    void storedAttributeMap_isNotMutated() {
        call("New Welcome", "New Fallback", null, null, null, null);

        assertThat(invoker.getAttributes()).containsEntry(Constants.WELCOME_CONVERSATION_NAME, STORED_WELCOME)
                .containsEntry(CommonInvokerParameters.FALLBACK_CONVERSATION, STORED_FALLBACK);
    }

    @Test
    @DisplayName("a blank welcome conversation clears it so the chatbot greets with the Welcome Message")
    void blankWelcomeConversation_clearsIt() {
        ExtensionResponse response = call("   ", null, null, null, null, null);

        assertThat(response.getResult()).isEqualTo(ExtensionResponse.Result.SUCCESS);
        assertThat(capturedAttributes().get(Constants.WELCOME_CONVERSATION_NAME)).isEqualTo("");
    }

    @Test
    @DisplayName("an omitted welcome conversation leaves the stored value untouched")
    void nullWelcomeConversation_leavesStoredValueUntouched() {
        ExtensionResponse response = call(null, null, null, null, null, null);

        assertThat(response.getResult()).isEqualTo(ExtensionResponse.Result.SUCCESS);
        assertThat(capturedAttributes().get(Constants.WELCOME_CONVERSATION_NAME)).isEqualTo(STORED_WELCOME);
    }

    @Test
    @DisplayName("a validation failure surfaces as INPUT_ERROR and saves nothing")
    void validationFailure_isReportedAsInputError() {
        doThrow(new IllegalArgumentException("Conversation \"Nope\" not found."))
                .when(chatBotExtension).validateAttributes(any());

        ExtensionResponse response = call("Nope", null, null, null, null, null);

        assertThat(response.getResult()).isEqualTo(ExtensionResponse.Result.FAILURE);
        assertThat(response.getError().getExceptionType())
                .isEqualTo(ExtensionResponse.Error.ExceptionType.INPUT_ERROR);
        assertThat(response.getError().getErrorMessage()).contains("not found");
        verifyNothingSaved();
    }

    @Test
    @DisplayName("an unexpected store failure surfaces as SYSTEM_ERROR instead of escaping")
    void unexpectedValidationException_isReportedAsSystemError() {
        doThrow(new IllegalStateException("conversation store unreachable"))
                .when(chatBotExtension).validateAttributes(any());

        ExtensionResponse response = call("New Welcome", null, null, null, null, null);

        assertThat(response.getResult()).isEqualTo(ExtensionResponse.Result.FAILURE);
        assertThat(response.getError().getExceptionType())
                .isEqualTo(ExtensionResponse.Error.ExceptionType.SYSTEM_ERROR);
        verifyNothingSaved();
    }

    @Test
    @DisplayName("a rejected save surfaces as SYSTEM_ERROR")
    void saveFailure_isReportedAsSystemError() {
        when(invokerConfiguration.saveChanges(anyString(), anyString(), any(), anyString(), anyBoolean(), any()))
                .thenReturn(false);

        ExtensionResponse response = call("New Welcome", null, null, null, null, null);

        assertThat(response.getResult()).isEqualTo(ExtensionResponse.Result.FAILURE);
        assertThat(response.getError().getExceptionType())
                .isEqualTo(ExtensionResponse.Error.ExceptionType.SYSTEM_ERROR);
    }

    @Test
    @DisplayName("a successful save reports a Status message")
    void success_reportsStatus() {
        ExtensionResponse response = call("New Welcome", null, null, null, null, null);

        assertThat(response.getResult()).isEqualTo(ExtensionResponse.Result.SUCCESS);
        assertThat(response.getResponseValue()).containsKey("Status");
        assertThat(response.getError()).isNull();
    }

    private void verifyNothingSaved() {
        verify(invokerConfiguration, never())
                .saveChanges(anyString(), anyString(), any(), anyString(), anyBoolean(), any());
    }
}
