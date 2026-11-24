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

import app.krista.ksdk.authorization.ModifiableRole;
import app.krista.ksdk.authorization.RoleManager;

import java.util.Objects;

/**
 * Shared helper for the chatbot's role resolution. Both fresh account
 * provisioning ({@link AccountProvisioner}) and the chatbot pool's in-place
 * role-update path ({@code ChatBotPool.changeDefaultRoleAsync}) need to
 * resolve a role name to a role ID, optionally creating the role if it does
 * not already exist. Centralising the lookup here keeps the account-creation
 * path and the role-change path from drifting.
 */
public final class RoleUtils {

    private RoleUtils() {
    }

    /**
     * Looks up a role's ID by name. Iterates the role catalog from the
     * supplied {@link RoleManager} and returns the matching role's ID.
     *
     * <p>If no role with that name exists:
     * <ul>
     *   <li>{@code createIfMissing == true}: creates the role and returns
     *       its new ID. Used by the account-creation path where the admin
     *       may configure a Default Role that hasn't been used yet.</li>
     *   <li>{@code createIfMissing == false}: returns {@code null}. Used
     *       when removing a previously-configured role from existing
     *       accounts — if the role is already gone, no removal is needed.</li>
     * </ul>
     *
     * @param roleManager    the role manager to query
     * @param roleName       the human-readable role name (may be null)
     * @param createIfMissing whether to create the role if absent
     * @return the resolved role ID, or {@code null} if {@code roleName} is
     *         null, or if the role is missing and we chose not to create it
     */
    public static String resolveRoleId(RoleManager roleManager, String roleName, boolean createIfMissing) {
        if (roleName == null) {
            return null;
        }
        for (ModifiableRole role : roleManager.getRoles()) {
            if (Objects.equals(roleName, role.getName())) {
                return role.getRoleId();
            }
        }
        if (createIfMissing) {
            return roleManager.createRole(roleName).getRoleId();
        }
        return null;
    }
}
