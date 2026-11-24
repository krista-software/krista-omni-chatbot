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

package app.krista.extensions.essentials.collaboration.omnichatbot.service;

import app.krista.extension.executor.Invoker;
import app.krista.extension.request.RoutingInfo;
import app.krista.extension.request.protos.http.HttpProtocol;
import app.krista.extensions.essentials.collaboration.omnichatbot.contants.Constants;
import org.jvnet.hk2.annotations.Service;
import org.slf4j.LoggerFactory;

import javax.ws.rs.core.Response;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.zip.GZIPOutputStream;

@Service
public class ChatBotUIService {

    private static final org.slf4j.Logger LOGGER = LoggerFactory.getLogger(ChatBotUIService.class);
    // CDN cache-busting version prefix. Increment on each release so CDN treats
    // the new path as a fresh cache key. Plain integer — regex \d+ matches all.
    // See CDN-VERSION-PREFIX-CHANGES.md for ops/dev details.
    // Public: ChatBotResource.preview() injects it into the live-preview page so it
    // can cache-bust the launcher's versioned /chatbot/{version}/config fetch.
    public static final String CDN_CACHE_VERSION = "0";
    // Versioned chatbot UI prefix used in all asset path rewrites.
    // Format: "chatbot/{version}/ui/" — ensures all asset URLs go through versioned CDN path.
    private static final String VERSIONED_CHATBOT_UI = "chatbot/" + CDN_CACHE_VERSION + "/ui/";
    private static final Map<String, String> UI_ASSET_CACHE_MAP = new ConcurrentHashMap<>();
    // Pre-gzipped versions of static assets keyed by subPath. Populated lazily on first
    // serve (and proactively by warmCache()); subsequent requests that send
    // Accept-Encoding: gzip are served directly from this cache.
    private static final Map<String, byte[]> UI_ASSET_GZIP_CACHE = new ConcurrentHashMap<>();
    // Text-only formats. Excluding image/svg+xml because some proxies / framework
    // chunking interactions return empty bodies for gzipped image MIME responses,
    // even though Content-Encoding: gzip is set. SVG wire-size savings (~70%) are
    // small compared to the main.js bundle win and not worth the regression risk.
    private static final Set<String> COMPRESSIBLE_EXTENSIONS =
            Set.of(".js", ".css", ".html", ".json");
    // index.html and launcher.js are gzipped per-request after placeholder substitution
    // (__chatbotBasePath__ for both, __POOLED_AUTH__ for index.html) — do not pre-cache them.
    private static final Set<String> PRE_GZIP_EXCLUDED = Set.of("index.html", "launcher.js");
    // Stable asset paths to pre-warm at extension startup. The hashed Angular bundles
    // (polyfills-*.js, main-*.js, styles-*.css) are discovered dynamically from
    // index.html so the list survives Angular re-builds that change content hashes.
    private static final java.util.List<String> STABLE_WARM_PATHS = java.util.List.of(
            "index.html",
            "assets/config.js",
            "assets/i18n/en.json"
    );
    // Pattern used to discover hashed bundles from index.html (post-rewrite paths).
    private static final java.util.regex.Pattern HASHED_BUNDLE_REF =
            java.util.regex.Pattern.compile("(?:src|href)=\"chatbot/\\d+/ui/([^\"]+\\.(?:js|css))\"");
    // <link rel="preload"> tags for the hashed Angular bundles, built once during
    // warmCache() and injected into every served index.html so the browser starts
    // downloading the bundles while still parsing <head> instead of waiting until
    // it reaches the deferred <script> tags at the end of <body>.
    private static final java.util.concurrent.atomic.AtomicReference<String> PRELOAD_LINKS =
            new java.util.concurrent.atomic.AtomicReference<>("");
    private static final String HEAD_CLOSE_TAG = "</head>";
    // Static MIME map for the file types we serve from /ui/**. Avoids per-request
    // Files.probeContentType lookups (slow on first hit, and inconsistent across
    // JDK versions — may return null for .svg, .woff2, .json on some JDKs, which
    // would surface as missing Content-Type headers downstream).
    private static final Map<String, String> MIME_TYPES = Map.ofEntries(
            Map.entry("js", "application/javascript"),
            Map.entry("css", "text/css"),
            Map.entry("html", "text/html"),
            Map.entry("json", "application/json"),
            Map.entry("map", "application/json"),
            Map.entry("svg", "image/svg+xml"),
            Map.entry("png", "image/png"),
            Map.entry("jpg", "image/jpeg"),
            Map.entry("jpeg", "image/jpeg"),
            Map.entry("gif", "image/gif"),
            Map.entry("ico", "image/x-icon"),
            Map.entry("woff", "font/woff"),
            Map.entry("woff2", "font/woff2"),
            Map.entry("ttf", "font/ttf"),
            Map.entry("txt", "text/plain")
    );

    /**
     * Serves UI assets with appropriate caching and content transformation.
     *
     * <p>This method handles serving static UI assets with the following features:
     * <ul>
     *   <li>Determines MIME type based on file extension</li>
     *   <li>Applies appropriate cache control headers (no-cache for index.html, launcher files)</li>
     *   <li>Caches asset content in memory for performance</li>
     *   <li>Serves pre-gzipped bytes when the client advertises {@code Accept-Encoding: gzip}</li>
     *   <li>Replaces placeholder paths with actual base URI in HTML and JS files</li>
     *   <li>Transforms asset paths for Angular build compatibility</li>
     * </ul>
     *
     * @param subPath          the sub-path within the UI assets directory
     * @param invoker          the Invoker instance
     * @param acceptEncoding   the raw {@code Accept-Encoding} header from the request, or {@code null}
     * @return a JAX-RS Response containing the asset content with appropriate headers
     * @throws IOException if the asset cannot be read
     */
    public Response getResponse(String subPath, Invoker invoker, String acceptEncoding) throws IOException {
        String cacheControl = Constants.CACHE_PUBLIC_1YEAR;
        // workspace/* deep-links are admin previews of the chatbot from inside the
        // workspace UI. They get the same index.html shell as a regular embed, but
        // we must NOT inject __POOLED_AUTH__ here: the admin already has a real
        // authenticated session, and consuming a pool entry would (a) silently
        // downgrade them to a guest account inside the chatbot and (b) waste a
        // provisioned guest on internal admin traffic.
        boolean fromWorkspace = subPath.startsWith("workspace/");
        if (subPath.trim().isEmpty() || subPath.equals("index.html") || fromWorkspace) {
            subPath = "index.html";
            cacheControl = fromWorkspace ? Constants.CACHE_NO_STORE : Constants.CACHE_PUBLIC_30MIN;
        }

        // launcher.js + launcher.css are user-independent per-invoker entry assets
        // (the URL carries the routingId, so no cross-bot bleed). Both are CDN-cached
        // (stale-if-error keeps them served during an Extension-Proxy outage/upgrade)
        // and their URLs are unchanged (hard-coded in live customer pages).
        // launcher.js is CDN-ONLY (max-age=0): the browser re-fetches it each page load
        // from the edge, so a launcher change propagates within the CDN TTL alone
        // (no browser-TTL stacking). launcher.css is browser+CDN cached for 30 min.
        if (subPath.equals("launcher.js")) {
            cacheControl = Constants.CACHE_CDN_ONLY_30MIN;
        } else if (subPath.equals("launcher.css")) {
            cacheControl = Constants.CACHE_PUBLIC_30MIN;
        }
        // Central cache gate: a `build-dev` jar (or CHATBOT_CACHE_DISABLED) forces every
        // asset — index.html, hashed /ui/* bundles, launcher.js/css — to no-store so the
        // browser/CDN always re-fetch. A production build leaves the value above untouched.
        cacheControl = Constants.resolveCacheControl(cacheControl);
        // Resolve MIME AFTER the rewrite so requests like "workspace/foo" report the
        // index.html MIME, not whatever (or null) the original sub-path implied.
        String mimeType = resolveMimeType(subPath);

        if (!UI_ASSET_CACHE_MAP.containsKey(subPath)) {
            String loaded = loadAndTransform(subPath, invoker);
            if (loaded == null) {
                return Response.status(Response.Status.NOT_FOUND)
                        .entity("UI asset not found: '" + subPath
                                + "'. Verify the file exists in the chatbot UI bundle.")
                        .build();
            }
            UI_ASSET_CACHE_MAP.put(subPath, loaded);
            if (isCompressible(subPath) && !PRE_GZIP_EXCLUDED.contains(subPath)) {
                UI_ASSET_GZIP_CACHE.put(subPath, gzip(loaded));
            }
        }

        String content = UI_ASSET_CACHE_MAP.get(subPath);
        boolean isIndex = "index.html".equals(subPath);
        // Inject <link rel="preload"> hints for the hashed Angular bundles so
        // the browser starts downloading them while still parsing <head>, rather
        // than waiting until it hits the deferred <script> tags at the bottom
        // of <body>. Pool-auth used to be injected here too, but the SPA now
        // fetches it via GET /authn/pool-entry — see ChatBotAuthResource.
        if (isIndex) {
            content = injectPreloadLinks(content);
        }

        boolean clientAcceptsGzip = acceptEncoding != null
                && acceptEncoding.toLowerCase().contains("gzip");

        // index.html is mutated per-request (__POOLED_AUTH__ injection above), so
        // it can't be served from the pre-gzip cache — gzip after injection.
        boolean perRequestMutation = isIndex;
        if (clientAcceptsGzip && isCompressible(subPath)) {
            byte[] gz = perRequestMutation
                    ? gzip(content)                     // mutated per-request: gzip after injection
                    : UI_ASSET_GZIP_CACHE.get(subPath); // static asset: served from cache
            if (gz != null) {
                // Do NOT set Content-Length explicitly: the framework's
                // ChunkedWriteHandler may add Transfer-Encoding: chunked, and having
                // both in the response is a protocol violation that some proxies
                // reject with 502. JAX-RS computes the correct value from the byte[].
                return Response.ok(gz)
                        .header("Content-Type", mimeType)
                        .header("Content-Encoding", "gzip")
                        .header("Cache-Control", cacheControl)
                        .header("Vary", "Accept-Encoding")
                        .build();
            }
        }

        // Fallback: client did not advertise gzip, or asset is not compressible.
        return Response.ok(content)
                .header("Content-Type", mimeType)
                .header("Cache-Control", cacheControl)
                .header("Vary", "Accept-Encoding")
                .build();
    }

    /**
     * Eagerly loads and gzips the well-known static assets so the first user request
     * does not pay the cold-cache cost (~50-100ms read + ~50-100ms gzip on a 2.9 MB
     * bundle). Safe to call multiple times — already-cached entries are skipped.
     *
     * <p>Called from ChatBotExtension during invoker load. Missing files are
     * logged at WARN but do not fail boot — Angular build hashes change per release
     * and an out-of-date entry should not block startup.
     *
     * @param invoker the invoker used for base-URL substitution
     */
    public void warmCache(Invoker invoker) {
        long start = System.currentTimeMillis();
        int loaded = 0;
        // Load the stable paths first. We need index.html cached before discovering
        // the hashed Angular bundle names from it.
        for (String subPath : STABLE_WARM_PATHS) {
            if (loadIntoCache(subPath, invoker)) {
                loaded++;
            }
        }
        // Discover and warm the hashed Angular bundles (polyfills-*.js, main-*.js,
        // styles-*.css) by parsing their references out of the rewritten index.html.
        // Build the preload-link snippet in the same pass so every served index.html
        // gets browser preload hints for the bundles it ultimately depends on.
        String indexHtml = UI_ASSET_CACHE_MAP.get("index.html");
        if (indexHtml != null) {
            StringBuilder preloads = new StringBuilder();
            java.util.regex.Matcher matcher = HASHED_BUNDLE_REF.matcher(indexHtml);
            while (matcher.find()) {
                String bundle = matcher.group(1);
                if (loadIntoCache(bundle, invoker)) {
                    loaded++;
                }
                // <script type="module"> requires modulepreload (not rel=preload as=script)
                // — the latter is a different CORS cache key and would cause a re-fetch.
                if (bundle.endsWith(".css")) {
                    preloads.append("<link rel=\"preload\" as=\"style\" href=\"").append(VERSIONED_CHATBOT_UI)
                            .append(bundle).append("\">");
                } else {
                    preloads.append("<link rel=\"modulepreload\" href=\"").append(VERSIONED_CHATBOT_UI)
                            .append(bundle).append("\">");
                }
            }
            PRELOAD_LINKS.set(preloads.toString());
        }

        // Second pass: inline the small per-request setup script into the cached
        // index.html. Saves an HTTP round-trip on every first-load: the browser
        // skips fetching /chatbot/ui/assets/config.js because its contents are
        // now sitting inline in <head>.
        inlineSmallAssetsIntoIndex();

        LOGGER.info("#####-CHATBOT-WARM loaded {} assets in {} ms",
                loaded, System.currentTimeMillis() - start);
    }

    /**
     * Replaces the {@code <script src="...config.js" defer>} tag in the
     * cached index.html with an inline {@code <script>...content...</script>}
     * tag.
     *
     * <p>Falls back gracefully: if the asset isn't cached or the pattern doesn't
     * match (e.g. Angular changed the script tag form), the index.html is left
     * unchanged and the browser loads the script via the original separate
     * request. Worst case = current behaviour, never a regression.
     */
    private void inlineSmallAssetsIntoIndex() {
        String indexHtml = UI_ASSET_CACHE_MAP.get("index.html");
        if (indexHtml == null) {
            return;
        }
        int beforeLen = indexHtml.length();
        indexHtml = replaceScriptSrcWithInline(indexHtml, "assets/config.js");
        if (indexHtml.length() != beforeLen) {
            UI_ASSET_CACHE_MAP.put("index.html", indexHtml);
        }
    }

    private String replaceScriptSrcWithInline(String html, String assetPath) {
        String inlinedContent = UI_ASSET_CACHE_MAP.get(assetPath);
        if (inlinedContent == null) {
            LOGGER.warn("#####-CHATBOT-INLINE skipping {} (not cached)", assetPath);
            return html;
        }
        // An inlined <script>...</script> body must not itself contain </script>
        // (would prematurely terminate the tag and break HTML parsing).
        if (inlinedContent.contains("</script>")) {
            LOGGER.warn("#####-CHATBOT-INLINE skipping {} (content contains </script>)", assetPath);
            return html;
        }
        // The script tag in index.html (after the /assets/ rewrite in loadAndTransform)
        // looks like:  <script type="text/javascript" src="chatbot/ui/assets/X.js" defer></script>
        // We anchor on the exact rewritten src to avoid matching any other script tag.
        String tagPath = VERSIONED_CHATBOT_UI + assetPath;
        String pattern = "<script\\s+type=\"text/javascript\"\\s+src=\""
                + java.util.regex.Pattern.quote(tagPath)
                + "\"\\s+defer></script>";
        String replacement = java.util.regex.Matcher.quoteReplacement(
                "<script>" + inlinedContent + "</script>");
        String result = html.replaceFirst(pattern, replacement);
        if (result.equals(html)) {
            LOGGER.warn("#####-CHATBOT-INLINE pattern did not match for {} (Angular may have changed the script tag)",
                    assetPath);
        }
        return result;
    }

    private boolean loadIntoCache(String subPath, Invoker invoker) {
        if (UI_ASSET_CACHE_MAP.containsKey(subPath)) {
            return false;
        }
        try {
            String content = loadAndTransform(subPath, invoker);
            if (content == null) {
                LOGGER.warn("#####-CHATBOT-WARM skipping missing asset: {}", subPath);
                return false;
            }
            UI_ASSET_CACHE_MAP.put(subPath, content);
            if (isCompressible(subPath) && !PRE_GZIP_EXCLUDED.contains(subPath)) {
                UI_ASSET_GZIP_CACHE.put(subPath, gzip(content));
            }
            return true;
        } catch (Exception cause) {
            LOGGER.warn("#####-CHATBOT-WARM failed to load {}: {}", subPath, cause.getMessage());
            return false;
        }
    }

    private String loadAndTransform(String subPath, Invoker invoker) throws IOException {
        String content;
        try (InputStream inputStream = getClass().getResourceAsStream("/ui/" + subPath)) {
            if (inputStream == null) {
                return null;
            }
            content = new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
        }

        // launcher.js is loaded from external host sites; substitute FULL URL.
        if (subPath.endsWith("launcher.js")) {
            content = content.replace("__chatbotBasePath__", getInvokerBaseUrl(invoker, true));
            content = content.replace("__cdnCacheVersion__", CDN_CACHE_VERSION);
        } else if (subPath.endsWith("index.html") || subPath.endsWith(Constants.LAUNCHER_CORE_FILENAME)) {
            content = content.replace("__chatbotBasePath__", getInvokerBaseUrl(invoker, false));
            content = content.replace("__cdnCacheVersion__", CDN_CACHE_VERSION);
        }

        // The /assets/ rewrite is needed on BOTH .html and .js: Angular's runtime
        // bundle embeds literal "/assets/images/..." strings that must be rewritten
        // to the chatbot's base path, otherwise the browser requests them at host
        // root (502). Cheap String.replace, no regex.
        if (subPath.endsWith(".html") || subPath.endsWith(".js")) {
            content = content.replace("/assets/", VERSIONED_CHATBOT_UI + "assets/");
        }

        // The (src|href)="...hashed-bundle..." regex only ever matches HTML script/link
        // tags. Skipping it on .js avoids a regex scan over multi-megabyte bundles.
        if (subPath.endsWith(".html")) {
            content = content.replaceAll("(src|href)=\"(polyfills|main|styles)-([A-Z0-9]+)\\.(js|css)\"",
                    "$1=\"" + VERSIONED_CHATBOT_UI + "$2-$3.$4\"");
        }
        return content;
    }

    private static boolean isCompressible(String subPath) {
        int dot = subPath.lastIndexOf('.');
        if (dot < 0) {
            return false;
        }
        return COMPRESSIBLE_EXTENSIONS.contains(subPath.substring(dot).toLowerCase());
    }

    // Static-map lookup keyed off file extension, with Files.probeContentType as a
    // last-resort fallback for extensions outside the map. The map covers every
    // extension we actually ship under /ui/**; the fallback exists so a new asset
    // type added to the bundle isn't served without a Content-Type until someone
    // updates this file.
    private static String resolveMimeType(String subPath) throws IOException {
        int dot = subPath.lastIndexOf('.');
        if (dot >= 0 && dot < subPath.length() - 1) {
            String mapped = MIME_TYPES.get(subPath.substring(dot + 1).toLowerCase());
            if (mapped != null) {
                return mapped;
            }
        }
        return Files.probeContentType(new File(subPath).toPath());
    }

    private static byte[] gzip(String content) throws IOException {
        byte[] raw = content.getBytes(StandardCharsets.UTF_8);
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream(raw.length / 2);
                GZIPOutputStream gz = new GZIPOutputStream(baos)) {
            gz.write(raw);
            gz.finish();
            return baos.toByteArray();
        }
    }

    /**
     * Injects {@code <link rel="modulepreload">} / {@code <link rel="preload"
     * as="style">} tags for the hashed Angular bundles (polyfills-*.js,
     * main-*.js, styles-*.css) right before the {@code </head>} so the
     * browser starts downloading them while still parsing {@code <head>},
     * instead of waiting until it hits the deferred {@code <script>} tags
     * at the bottom of {@code <body>}.
     *
     * <p>Pool-auth used to ride along here as a {@code <script>
     * window.__POOLED_AUTH__ = ...</script>} block, but that broke when a
     * downstream proxy cached the response — the same identity got pinned
     * across users. The SPA now fetches its identity via
     * {@code GET /authn/pool-entry} (see {@code ChatBotAuthResource}).
     */
    private String injectPreloadLinks(String html) {
        String snippet = PRELOAD_LINKS.get();
        if (snippet.isEmpty()) {
            return html;
        }
        if (html.contains(HEAD_CLOSE_TAG)) {
            return html.replaceFirst(HEAD_CLOSE_TAG, snippet + HEAD_CLOSE_TAG);
        }
        LOGGER.warn("#####-CHATBOT could not find {} in index.html; serving without preload injection",
                HEAD_CLOSE_TAG);
        return html;
    }

    /**
     * Gets the base URL from the invoker.
     *
     * @param invoker the Invoker instance
     * @param includeHostAndProtocol if true, returns full URL (protocol + host + path);
     *                               if false, returns path only
     * @return the base URL
     *
     * Examples:
     * - includeHostAndProtocol = true:  "<a href="https://extension.uslab-qa.eng.krista.app/extension/api/_sfPIQ0zdNP85mZD6CJA7PQ_e_e/">...</a>"
     * - includeHostAndProtocol = false: "/extension/api/gn_phVThMkKhxk0S8wFInPQ_e_e/"
     * <p>
     * Use cases:
     * - true:  For launcher.js which is loaded from external websites and needs full URL for cross-origin requests
     * - false: For index.html and launcher-core files loaded within the Krista application where relative paths work
     */
    private String getInvokerBaseUrl(Invoker invoker, boolean includeHostAndProtocol) {
        try {
            String routingURL = invoker.getRoutingInfo().getRoutingURL(HttpProtocol.PROTOCOL_NAME, RoutingInfo.Type.APPLIANCE);
            URI parsedUri = new URI(routingURL);

            if (!includeHostAndProtocol) {
                // Return path only
                String path = parsedUri.getPath();
                return path.endsWith("/") ? path : path + "/";
            }

            // Return full URL (protocol + host + path)
            String protocol = parsedUri.getScheme();
            String host = parsedUri.getHost();
            int port = parsedUri.getPort();
            String path = parsedUri.getPath();

            StringBuilder fullUrl = new StringBuilder();
            fullUrl.append(protocol).append("://").append(host);

            // Only include port if it's not the default port for the protocol
            if (port != -1 && port != 80 && port != 443) {
                fullUrl.append(":").append(port);
            }

            // Append the path
            fullUrl.append(path);

            // Ensure it ends with a slash
            if (!path.endsWith("/")) {
                fullUrl.append("/");
            }

            return fullUrl.toString();
        } catch (URISyntaxException e) {
            LOGGER.error("Failed to parse routing URL", e);
            throw new IllegalStateException("Failed to get base URL", e);
        }
    }
}
