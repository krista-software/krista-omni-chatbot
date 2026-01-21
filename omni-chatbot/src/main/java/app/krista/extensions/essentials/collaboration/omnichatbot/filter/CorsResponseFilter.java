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

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerResponseContext;
import javax.ws.rs.container.ContainerResponseFilter;
import javax.ws.rs.ext.Provider;
import java.io.IOException;

/**
 * CORS (Cross-Origin Resource Sharing) response filter that adds necessary headers
 * to all API responses to enable cross-origin requests.
 *
 * This filter automatically adds the following headers to every response:
 * - Access-Control-Allow-Origin: * (allows requests from any origin)
 * - Access-Control-Allow-Headers: Content-Type, Authorization, X-Krista-Original-URI (allows these headers in requests)
 * - Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS (allows these HTTP methods)
 */
@Provider
public class CorsResponseFilter implements ContainerResponseFilter {

    private static final Logger LOGGER = LoggerFactory.getLogger(CorsResponseFilter.class);

    private static final String HEADER_ACCESS_CONTROL_ALLOW_ORIGIN = "Access-Control-Allow-Origin";
    private static final String HEADER_ACCESS_CONTROL_ALLOW_HEADERS = "Access-Control-Allow-Headers";
    private static final String HEADER_ACCESS_CONTROL_ALLOW_METHODS = "Access-Control-Allow-Methods";

    private static final String ALLOW_ORIGIN_VALUE = "*";
    private static final String ALLOW_HEADERS_VALUE = "Content-Type, Authorization, X-Krista-Original-URI";
    private static final String ALLOW_METHODS_VALUE = "GET, POST, PUT, OPTIONS";

    /**
     * Filters the response by adding CORS headers.
     * This method is automatically invoked by the JAX-RS runtime for every response.
     *
     * @param requestContext  the request context
     * @param responseContext the response context
     * @throws IOException if an I/O error occurs
     */
    @Override
    public void filter(ContainerRequestContext requestContext,
                      ContainerResponseContext responseContext) throws IOException {

        // Add CORS headers to the response
        responseContext.getHeaders().add(HEADER_ACCESS_CONTROL_ALLOW_ORIGIN, ALLOW_ORIGIN_VALUE);
        responseContext.getHeaders().add(HEADER_ACCESS_CONTROL_ALLOW_HEADERS, ALLOW_HEADERS_VALUE);
        responseContext.getHeaders().add(HEADER_ACCESS_CONTROL_ALLOW_METHODS, ALLOW_METHODS_VALUE);

        LOGGER.debug("CORS headers added to response for path: {}", requestContext.getUriInfo().getPath());
    }
}

