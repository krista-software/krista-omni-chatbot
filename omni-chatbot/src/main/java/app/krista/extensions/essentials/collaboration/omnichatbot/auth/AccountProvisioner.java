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

import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.*;
import javax.inject.Inject;
import app.krista.extension.authorization.AuthorizationException;
import app.krista.extension.executor.Invoker;
import app.krista.extension.util.InvokerAttributes;
import app.krista.ksdk.accounts.Account;
import app.krista.ksdk.accounts.AccountManager;
import app.krista.ksdk.accounts.ModifiableAccount;
import app.krista.ksdk.authorization.Role;
import app.krista.ksdk.authorization.RoleManager;
import app.krista.omni.sdk.spi.impl.services.AccountService;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.jvnet.hk2.annotations.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public final class AccountProvisioner {

    private static final Logger LOGGER = LoggerFactory.getLogger(AccountProvisioner.class);

    private final AccountManager accountManager;
    private final RoleManager roleManager;
    private final Invoker invoker;

    private final Map<String, Object> defaultAttributes = Map.of("ORG", "KristaSoft",
            "KRISTA_SOURCE", "Omni Chatbot",
            "SOURCE", "OMNI");

    @Inject
    public AccountProvisioner(AccountManager accountManager, RoleManager roleManager, Invoker invoker) {
        this.accountManager = accountManager;
        this.roleManager = roleManager;
        this.invoker = invoker;
    }

    public AccountManager getAccountManager() {
        return accountManager;
    }

    /**
     * Provisions an account with the supplied {@code defaultRoleName}.
     * Callers are responsible for resolving the role up-front via
     * {@link #getDefaultRoleName()} (or one of the override paths
     * such as the pool refill's per-cycle resolution). Passing {@code null}
     * here is a programming error.
     */
    public Account provisionAccount(String emailAddress, String defaultRoleName) {
        Map<String, Object> invokerAttributes = invoker.getAttributes();
        String roleId = getOrCreateRoleId(defaultRoleName);

        ModifiableAccount modifiableAccount = accountManager.lookupAccount(emailAddress);
        Set<String> roleIds = new LinkedHashSet<>();
        roleIds.add(roleId);
        if (modifiableAccount == null) {
            modifiableAccount = accountManager.createAccount(EmailAddresses.getLocalPart(emailAddress),
                    EmailAddresses.normalizeEmailAddress(emailAddress),
                    roleIds, buildAccountAttributes(invokerAttributes));
        } else {
            modifiableAccount.getRoles().stream().map(Role::getRoleId).forEach(roleIds::add);
            modifiableAccount.addRole(roleIds.toArray(String[]::new));
        }
        return modifiableAccount;
    }

    private Map<String, Object> buildAccountAttributes(Map<String, Object> invokerAttributes) {
        Map<String, Object> userAttributes = new HashMap<>();
        userAttributes.put("KRISTA_LAST_LOGIN", getCurrentDateTime());
        userAttributes.putAll(defaultAttributes);
        // Encode the owner-invoker id into KRISTA_SOURCE so the adoption scan
        // can identify orphans without us defining a new workspace attribute
        // (see comment in AuthConstants.KRISTA_SOURCE_OMNI_CHATBOT_PREFIX for
        // why we don't use a separate OWNER_INVOKER_ID custom attribute). This
        // OVERRIDES the "Omni Chatbot" value already set via defaultAttributes
        // above — final value is "Omni Chatbot|<invokerId>".
        userAttributes.put(AuthConstants.KRISTA_SOURCE_KEY,
                AuthConstants.KRISTA_SOURCE_OMNI_CHATBOT_PREFIX + invoker.getInvokerId());

        String customAttributes = (String) invokerAttributes.getOrDefault(AuthConstants.ATTRIBUTE_PARAMETERS, "");

        if (!customAttributes.isBlank()) {
            JsonObject jsonObject = JsonParser.parseString(customAttributes).getAsJsonObject();

            for (Map.Entry<String, JsonElement> entry : jsonObject.entrySet()) {
                JsonElement value = entry.getValue();
                if (value == null || !value.isJsonPrimitive() || !value.getAsJsonPrimitive().isString()
                        || value.getAsString().isBlank()) {
                    continue;
                }
                userAttributes.put(entry.getKey(), value.getAsString());
            }
        }
        return userAttributes;
    }

    private String getOrCreateRoleId(String roleName) throws AuthorizationException {
        return RoleUtils.resolveRoleId(roleManager, roleName, true);
    }

    /**
     * Resolves the current chatbot invoker's configured Default Role,
     * falling back to {@link AuthConstants#DEFAULT_ROLE_FOR_NEW_ACCOUNT}
     * ("Krista Guest User") when the attribute is unset.
     */
    public String getDefaultRoleName() {
        return InvokerAttributes.getStringOrDefault(invoker.getAttributes(),
                AuthConstants.DEFAULT_ROLE_KEY, AuthConstants.DEFAULT_ROLE_FOR_NEW_ACCOUNT);
    }

    private String getCurrentDateTime() {
        DateFormat dateFormat = new SimpleDateFormat(AccountService.DATE_FORMAT);
        dateFormat.setTimeZone(TimeZone.getTimeZone(AccountService.GMT));
        return dateFormat.format(Calendar.getInstance().getTime());
    }

}
