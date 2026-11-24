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

import java.util.List;
import java.util.Map;

public class Configuration {
    private final Map<String, Object> config;
    private final String workspaceId;
    private final String nodeName;
    private final String icon;
    private final boolean isMultilingualEnabled;
    private final String kristaAccountId;
    // Inlined supported-languages list — populated alongside isMultilingualEnabled
    // so the chatbot can avoid a separate GET /chatbot/supportedLanguages
    // round-trip on every page load. Each entry has keys "code" and "name".
    private final List<Map<String, String>> supportedLanguages;

    public Configuration(Map<String, Object> config, String workspaceId, String nodeName, String icon,
            boolean isMultilingualEnabled, String kristaAccountId, List<Map<String, String>> supportedLanguages) {
        this.config = config;
        this.workspaceId = workspaceId;
        this.nodeName = nodeName;
        this.icon = icon;
        this.isMultilingualEnabled = isMultilingualEnabled;
        this.kristaAccountId = kristaAccountId;
        this.supportedLanguages = supportedLanguages;
    }
}
