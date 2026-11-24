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

package app.krista.extensions.essentials.collaboration.omnichatbot.resource;

import app.krista.extension.impl.jaxrs.util.Resources;
import app.krista.extensions.essentials.collaboration.omnichatbot.audit.AuditService;
import app.krista.extensions.essentials.collaboration.omnichatbot.contants.Constants;

import javax.inject.Inject;
import javax.ws.rs.*;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.io.IOException;
import java.util.Map;

/**
 * Read-only REST resource for the chatbot audit tab (Integration Settings page).
 *
 * <p>All three endpoints are served under the {@code /chatbot/audit/} prefix and
 * are listed in {@link ChatBotAuthenticator#isStaticOrPublicPath} so Studio admin
 * requests from the integration page bypass the guest auth round-trip.
 *
 * <p>All responses carry {@code no-store} cache headers (via
 * {@link app.krista.extensions.essentials.collaboration.omnichatbot.filter.CacheControlResponseFilter})
 * — audit data must always be fresh.
 */
@Path("/audit")
public class AuditResource {

    private final AuditService auditService;

    @Inject
    public AuditResource(AuditService auditService) {
        this.auditService = auditService;
    }

    /**
     * Returns KPI summary counters and the 7-day bar chart for the requested
     * time range.
     *
     * @param range time range: {@code 1h}, {@code 6h}, {@code 24h} (default),
     *              {@code 7d}, or {@code 30d}
     */
    @GET
    @Path("/summary")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getSummary(@QueryParam("range") @DefaultValue("24h") String range) {
        return Response.ok(auditService.getSummary(range))
                .header("Cache-Control", Constants.CACHE_NO_STORE)
                .build();
    }

    /**
     * Returns the live active-user count, queue depth, and last-activity
     * timestamp. Designed for the 30-second auto-refresh on the audit tab.
     */
    @GET
    @Path("/status")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getStatus() {
        return Response.ok(auditService.getStatus())
                .header("Cache-Control", Constants.CACHE_NO_STORE)
                .build();
    }

    /**
     * Serves the standalone Analytics &amp; Audit custom tab page.
     * Registered as {@code "Analytics & Audit"} in
     * {@link app.krista.extensions.essentials.collaboration.omnichatbot.ChatBotExtension#getCustomTabs()}.
     */
    @GET
    @Path("/")
    @Produces("text/html")
    public Response getAuditTab() throws IOException {
        return Resources.getTranslatedResource(getClass(), "audit/index.html", Map.of());
    }
}
