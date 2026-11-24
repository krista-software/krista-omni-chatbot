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

package app.krista.extensions.essentials.collaboration.omnichatbot.filter;

import app.krista.extensions.essentials.collaboration.omnichatbot.contants.Constants;

import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerResponseContext;
import javax.ws.rs.container.ContainerResponseFilter;
import javax.ws.rs.core.HttpHeaders;
import javax.ws.rs.ext.Provider;
import java.io.IOException;

/**
 * Default-deny cache policy: stamps {@code Cache-Control: no-store} on any response
 * that does not already set one.
 *
 * <p>Endpoints that are safe to cache (config, supportedLanguages, launcher.js/css,
 * {@code /ui/} assets) set their own {@code public, max-age=...} header and are left
 * untouched. Everything else — {@code /session}, {@code /authn/*},
 * {@code /inboxes/*}/messages, and any endpoint added in the future — is made
 * explicitly uncacheable here.
 *
 * <p>This makes the origin the single source of truth for cacheability, so one generic
 * CloudFront behavior can safely honor the origin {@code Cache-Control}: a new or
 * dynamic endpoint is uncacheable by default and can never be cached by accident.
 */
@Provider
public class CacheControlResponseFilter implements ContainerResponseFilter {

    @Override
    public void filter(ContainerRequestContext requestContext, ContainerResponseContext responseContext) throws IOException {
        if (!responseContext.getHeaders().containsKey(HttpHeaders.CACHE_CONTROL)) {
            responseContext.getHeaders().add(HttpHeaders.CACHE_CONTROL, Constants.CACHE_NO_STORE);
        }
    }
}
