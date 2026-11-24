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

import javax.inject.Inject;
import app.krista.extension.authorization.AuthorizationException;
import app.krista.extension.executor.Invoker;
import app.krista.ksdk.accounts.Account;
import app.krista.ksdk.authorization.ModifiableRole;
import app.krista.ksdk.authorization.RoleManager;
import org.jvnet.hk2.annotations.Service;

@Service
public final class GuestAuthenticationRoleManager {

    private final Invoker invoker;
    private final RoleManager roleManager;

    @Inject
    public GuestAuthenticationRoleManager(Invoker invoker, RoleManager roleManager) {
        this.invoker = invoker;
        this.roleManager = roleManager;
    }

    public ModifiableRole provisionDefaultRole() throws AuthorizationException {
        return getModifiableRole(getDefaultRoleName());
    }

    boolean hasAdminRole(Account account) {
        return roleManager.isWorkspaceAdmin(account);
    }

    private ModifiableRole getModifiableRole(String roleName) {
        ModifiableRole modifiableRole = roleManager.lookupRole(roleName);
        if (null == modifiableRole) {
            roleManager.createRole(roleName);
        }
        return modifiableRole;
    }

    private String getDefaultRoleName() {
        String defaultRole = AuthConstants.DEFAULT_ROLE_FOR_NEW_ACCOUNT;
        Object defaultRoleObject = invoker.getAttributes().get(AuthConstants.DEFAULT_ROLE_FOR_NEW_ACCOUNT);
        if (defaultRoleObject instanceof String && !((String) defaultRoleObject).isBlank()) {
            defaultRole = (String) defaultRoleObject;
        }
        return defaultRole;
    }

}
