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

import app.krista.ksdk.context.RequestContext;
import com.kristasoft.common.holders.ThreadLocalProxy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerRequestFilter;
import javax.ws.rs.container.ContainerResponseContext;
import javax.ws.rs.container.ContainerResponseFilter;
import javax.ws.rs.container.PreMatching;
import javax.ws.rs.core.Response;
import javax.ws.rs.ext.Provider;
import java.io.IOException;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * CORS (Cross-Origin Resource Sharing) filter that handles both preflight OPTIONS requests
 * and adds necessary headers to all API responses to enable cross-origin requests.
 *
 * This filter:
 * - Intercepts OPTIONS preflight requests before resource matching and returns 200 with CORS headers
 * - Adds CORS headers to all other API responses
 * - Records where the chatbot is being embedded (parent site + viewer location) for usage analytics
 *
 * Headers added:
 * - Access-Control-Allow-Origin: * (allows requests from any origin)
 * - Access-Control-Allow-Headers: Content-Type, Authorization, X-Krista-Original-URI, Chatbot-Session-Id, X-Krista-Context
 * - Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
 */
@Provider
@PreMatching
public class CorsResponseFilter implements ContainerRequestFilter, ContainerResponseFilter {

    private static final Logger LOGGER = LoggerFactory.getLogger(CorsResponseFilter.class);

    private static final String HEADER_ACCESS_CONTROL_ALLOW_ORIGIN = "Access-Control-Allow-Origin";
    private static final String HEADER_ACCESS_CONTROL_ALLOW_HEADERS = "Access-Control-Allow-Headers";
    private static final String HEADER_ACCESS_CONTROL_ALLOW_METHODS = "Access-Control-Allow-Methods";
    private static final String HEADER_ACCESS_CONTROL_MAX_AGE = "Access-Control-Max-Age";

    private static final String ALLOW_ORIGIN_VALUE = "*";
    private static final String ALLOW_HEADERS_VALUE = "Content-Type, Authorization, X-Krista-Original-URI, Chatbot-Session-Id, X-Krista-Context";
    private static final String ALLOW_METHODS_VALUE = "GET, POST, PUT, DELETE, OPTIONS";
    // Let the browser cache the preflight result so it does not re-send an OPTIONS
    // before every cross-origin call that carries custom headers (Chatbot-Session-Id,
    // X-Krista-Context). 7200s = Chromium's hard cap; Firefox caps at 24h.
    private static final String MAX_AGE_VALUE = "7200";

    private static final String HEADER_ORIGIN = "Origin";
    private static final String HEADER_REFERER = "Referer";
    private static final String HEADER_HOST = "Host";
    // Public host the request came in on (the proxy/CDN rewrites Host to the internal
    // origin, so Host alone is not the public host — X-Forwarded-Host preserves it when set).
    private static final String HEADER_X_FORWARDED_HOST = "X-Forwarded-Host";
    // The real client IP is injected by the fronting proxy/LB; the socket address would
    // just be the proxy. First entry of X-Forwarded-For is the originating client.
    private static final String HEADER_X_FORWARDED_FOR = "X-Forwarded-For";

    // The deployment is fronted by AWS CloudFront, which can add the viewer's geo as
    // request headers to the origin — but only when the distribution's origin request
    // policy is configured to forward the CloudFront geolocation headers. When that is
    // enabled these arrive on requests that reach the origin (cache misses / dynamic
    // calls such as /config); "CloudFront-Viewer-Country" is an ISO 3166-1 alpha-2 code.
    private static final String HEADER_CF_COUNTRY = "CloudFront-Viewer-Country";
    private static final String HEADER_CF_COUNTRY_NAME = "CloudFront-Viewer-Country-Name";
    private static final String HEADER_CF_REGION_NAME = "CloudFront-Viewer-Country-Region-Name";
    private static final String HEADER_CF_CITY = "CloudFront-Viewer-City";

    // The chatbot's own iframe/app is served under these path segments, so a Referer
    // containing them is this deployment's own UI calling back — not a third-party embed.
    private static final String INTERNAL_PATH_UI = "/chatbot/";
    private static final String INTERNAL_PATH_API = "/extension/api/";

    private static final String UNKNOWN = "unknown";

    // Hosts this chatbot is served from (its own iframe/app/launcher origin). Behind a
    // CDN/proxy the Host header at the origin is the internal one and X-Forwarded-Host is
    // not always set, so these are registered explicitly from the invoker's routing URL
    // (see ChatBotExtension#onInvokerLoad). Used to exclude the chatbot's own traffic from
    // embed analytics regardless of forwarding headers.
    private static final Set<String> SELF_HOSTS = ConcurrentHashMap.newKeySet();

    // Fallback invoker id captured at invoker load, used for the embed log when the
    // per-request RequestContext thread-local is not available.
    private static volatile String fallbackInvokerId;

    /**
     * Registers a host this chatbot is served from, so its own iframe/app/launcher calls
     * are excluded from embed analytics. Accepts a full URL or a bare host; the host part
     * is extracted and stored. Safe to call repeatedly (deduplicated).
     *
     * @param urlOrHost the routing URL or host of this chatbot deployment
     */
    public static void registerSelfHost(String urlOrHost) {
        String host = hostOf(urlOrHost);
        if (host != null) {
            SELF_HOSTS.add(host.toLowerCase(Locale.ROOT));
        }
    }

    /**
     * Registers the invoker id of this chatbot deployment, used as a fallback for the embed
     * log when the per-request RequestContext is unavailable. Safe to call repeatedly.
     *
     * @param invokerId the invoker id
     */
    public static void registerInvokerId(String invokerId) {
        if (invokerId != null && !invokerId.isBlank()) {
            fallbackInvokerId = invokerId;
        }
    }

    /**
     * Pre-matching request filter that intercepts OPTIONS preflight requests.
     * Returns a 200 OK response with CORS headers immediately, before JAX-RS
     * attempts to match a resource method.
     *
     * This ensures that preflight requests always receive proper CORS headers,
     * even when no @OPTIONS resource method is defined.
     *
     * @param requestContext the request context
     * @throws IOException if an I/O error occurs
     */
    @Override
    public void filter(ContainerRequestContext requestContext) throws IOException {
        if ("OPTIONS".equalsIgnoreCase(requestContext.getMethod())) {
            LOGGER.debug("CORS preflight request intercepted for path: {}", requestContext.getUriInfo().getPath());
            requestContext.abortWith(
                Response.ok()
                    .header(HEADER_ACCESS_CONTROL_ALLOW_ORIGIN, ALLOW_ORIGIN_VALUE)
                    .header(HEADER_ACCESS_CONTROL_ALLOW_HEADERS, ALLOW_HEADERS_VALUE)
                    .header(HEADER_ACCESS_CONTROL_ALLOW_METHODS, ALLOW_METHODS_VALUE)
                    .header(HEADER_ACCESS_CONTROL_MAX_AGE, MAX_AGE_VALUE)
                    .build()
            );
        } else {
            logEmbedUsage(requestContext);
        }
    }

    /**
     * Records where the chatbot is being embedded, for usage analytics.
     *
     * <p>The launcher runs in the host page, so its cross-origin requests carry the
     * embedding site in the {@code Origin} (or {@code Referer}) header. The chatbot's own
     * iframe/app and launcher are served from this same deployment, so their calls are
     * recognised and skipped (see {@link #isInternalCaller}) — only genuine third-party
     * embedders are recorded.
     *
     * <p>The viewer's location comes from the CloudFront geolocation request headers when
     * the distribution forwards them; otherwise it falls back to the originating client IP
     * from {@code X-Forwarded-For}.
     *
     * <p>For now this only logs. A later iteration will emit a TelemetryMetrics counter
     * keyed by {invokerId, parentOrigin, country}.
     *
     * @param requestContext the request context
     */
    private void logEmbedUsage(ContainerRequestContext requestContext) {
        try {
            String origin = requestContext.getHeaderString(HEADER_ORIGIN);
            String referer = requestContext.getHeaderString(HEADER_REFERER);
            String parentSite = (origin != null && !origin.isBlank()) ? origin : referer;
            if (parentSite == null || parentSite.isBlank()) {
                // No embedding-site signal (e.g. a direct API hit). Nothing to record.
                return;
            }
            if (isInternalCaller(parentSite, requestContext)) {
                return;
            }
            String location = resolveLocation(requestContext);
            if (location == null) {
                // CloudFront geo headers not present (not yet forwarded by the
                // distribution); fall back to the raw client IP so the entry is still useful.
                String clientIp = firstForwardedIp(requestContext.getHeaderString(HEADER_X_FORWARDED_FOR));
                location = (clientIp != null) ? ("ip:" + clientIp) : UNKNOWN;
            }
            LOGGER.info("#####-CHATBOT-EMBED invokerId={} parentSite={} location={} request={}",
                    currentInvokerId(), parentSite, location, requestContext.getUriInfo().getRequestUri());
        } catch (Exception cause) {
            // Analytics logging must never affect request handling.
            LOGGER.debug("#####-CHATBOT-EMBED failed to record embed usage", cause);
        }
    }

    /**
     * Resolves the invoker id for the current request from the kSDK {@link RequestContext}
     * thread-local, falling back to the id registered at invoker load (see
     * {@link #registerInvokerId}) and finally {@code "unknown"}.
     */
    private static String currentInvokerId() {
        try {
            RequestContext requestContext = ThreadLocalProxy.getThreadLocal(RequestContext.class).get();
            if (requestContext != null && requestContext.getInvokerId() != null
                    && !requestContext.getInvokerId().isBlank()) {
                return requestContext.getInvokerId();
            }
        } catch (Exception ignored) {
            // fall through to the registered fallback
        }
        return fallbackInvokerId != null ? fallbackInvokerId : UNKNOWN;
    }

    /**
     * Returns {@code true} when the {@code parentSite} is this chatbot deployment itself
     * (its own iframe/app or launcher calling back), so it is excluded from embed analytics.
     *
     * <p>Detected by either: the parent URL carrying the chatbot's own app path
     * ({@code /chatbot/} or {@code /extension/api/}) in its Referer, the parent host being
     * a registered self host (from the invoker routing URL), or the parent host matching the
     * host this request was served on ({@code Host} or {@code X-Forwarded-Host}).
     */
    private static boolean isInternalCaller(String parentSite, ContainerRequestContext requestContext) {
        if (parentSite.contains(INTERNAL_PATH_UI) || parentSite.contains(INTERNAL_PATH_API)) {
            return true;
        }
        String parentHost = hostOf(parentSite);
        if (parentHost == null) {
            return false;
        }
        if (SELF_HOSTS.contains(parentHost.toLowerCase(Locale.ROOT))) {
            return true;
        }
        return parentHost.equalsIgnoreCase(hostOf(requestContext.getHeaderString(HEADER_HOST)))
                || parentHost.equalsIgnoreCase(hostOf(requestContext.getHeaderString(HEADER_X_FORWARDED_HOST)));
    }

    /**
     * Builds a human-readable viewer location ("City, Region, Country") from the
     * CloudFront geolocation request headers, or {@code null} when none are present.
     *
     * <p>{@code CloudFront-Viewer-Country} is an ISO 3166-1 alpha-2 code; when the
     * country-name header is absent it is mapped to a display name via {@link Locale}
     * (e.g. {@code IN} -> {@code India}), falling back to the raw code if unmapped.
     */
    private static String resolveLocation(ContainerRequestContext requestContext) {
        String countryCode = trimToNull(requestContext.getHeaderString(HEADER_CF_COUNTRY));
        String countryName = trimToNull(requestContext.getHeaderString(HEADER_CF_COUNTRY_NAME));
        String region = trimToNull(requestContext.getHeaderString(HEADER_CF_REGION_NAME));
        String city = trimToNull(requestContext.getHeaderString(HEADER_CF_CITY));

        if (countryName == null && countryCode != null) {
            String display = new Locale("", countryCode).getDisplayCountry(Locale.ENGLISH);
            countryName = (!display.isBlank() && !display.equalsIgnoreCase(countryCode)) ? display : countryCode;
        }
        if (countryName == null) {
            return null;
        }
        StringBuilder area = new StringBuilder();
        if (city != null) {
            area.append(city).append(", ");
        }
        if (region != null) {
            area.append(region).append(", ");
        }
        area.append(countryName);
        return area.toString();
    }

    /**
     * Extracts the bare host from a URL/authority value, stripping any scheme, path and
     * port (e.g. {@code https://site.com:8443/x} -> {@code site.com}).
     */
    private static String hostOf(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String result = value.trim();
        int schemeEnd = result.indexOf("://");
        if (schemeEnd >= 0) {
            result = result.substring(schemeEnd + 3);
        }
        int pathStart = result.indexOf('/');
        if (pathStart >= 0) {
            result = result.substring(0, pathStart);
        }
        int portStart = result.indexOf(':');
        if (portStart >= 0) {
            result = result.substring(0, portStart);
        }
        return result.isBlank() ? null : result;
    }

    /**
     * Returns the originating client IP — the first entry of the X-Forwarded-For chain —
     * or {@code null} when the header is absent (e.g. a request that did not pass through
     * a forwarding proxy).
     */
    private static String firstForwardedIp(String xForwardedFor) {
        if (xForwardedFor == null || xForwardedFor.isBlank()) {
            return null;
        }
        int comma = xForwardedFor.indexOf(',');
        return (comma >= 0 ? xForwardedFor.substring(0, comma) : xForwardedFor).trim();
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

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
