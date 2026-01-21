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

import com.google.gson.annotations.SerializedName;

public class InboxRequest {
    @SerializedName("inboxId")
    private String inboxId;

    public InboxRequest() {
        // Default constructor for Gson
    }

    public InboxRequest(String inboxId) {
        this.inboxId = inboxId;
    }

    public String getInboxId() {
        return inboxId;
    }

    public void setInboxId(String inboxId) {
        this.inboxId = inboxId;
    }

    @Override
    public String toString() {
        return "InboxRequest{" +
                "inboxId='" + inboxId + '\'' +
                '}';
    }
}