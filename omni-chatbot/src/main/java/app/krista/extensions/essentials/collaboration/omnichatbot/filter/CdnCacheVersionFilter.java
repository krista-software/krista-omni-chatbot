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


import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerRequestFilter;
import javax.ws.rs.container.PreMatching;
import javax.ws.rs.ext.Provider;
import java.io.IOException;
import java.net.URI;

/**
 * Pre-matching filter that strips the CDN cache version prefix from request paths.
 *
 * <p>Launcher.js injects a numeric version segment into all subsequent chatbot URLs
 * for CDN cache-busting (e.g. {@code /chatbot/0/ui/...} instead of {@code /chatbot/ui/...}).
 * This filter strips the leading {@code /{digits}/} so JAX-RS routes match as before.
 *
 * <p>Only numeric-only path segments are stripped — no risk of colliding with real
 * resource paths like {@code /ui/}, {@code /config}, {@code /authn/}, etc.
 */
@Provider
@PreMatching
public class CdnCacheVersionFilter implements ContainerRequestFilter {

    @Override
    public void filter(ContainerRequestContext requestContext) throws IOException {
        String path = requestContext.getUriInfo().getPath();

        // Strip leading numeric version prefix: "0/ui/index.html" → "ui/index.html"
        if (path != null && path.matches("^\\d+/.*")) {
            String stripped = path.replaceFirst("^\\d+/", "");
            URI baseUri = requestContext.getUriInfo().getBaseUri();
            URI newUri = baseUri.resolve(stripped);
            requestContext.setRequestUri(baseUri, newUri);
        }
    }
}
