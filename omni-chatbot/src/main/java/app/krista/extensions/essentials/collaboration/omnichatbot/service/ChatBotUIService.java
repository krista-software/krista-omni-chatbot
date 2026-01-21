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
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.HashMap;
import java.util.Map;

@Service
public class ChatBotUIService {

    private static final org.slf4j.Logger LOGGER = LoggerFactory.getLogger(ChatBotUIService.class);
    private static final Map<String, String> UI_ASSET_CACHE_MAP = new HashMap<>();

    /**
     * Serves UI assets with appropriate caching and content transformation.
     *
     * <p>This method handles serving static UI assets with the following features:
     * <ul>
     *   <li>Determines MIME type based on file extension</li>
     *   <li>Applies appropriate cache control headers (no-cache for index.html, launcher files)</li>
     *   <li>Caches asset content in memory for performance</li>
     *   <li>Replaces placeholder paths with actual base URI in HTML and JS files</li>
     *   <li>Transforms asset paths for Vite compatibility</li>
     * </ul>
     *
     * @param invoker the Invoker instance
     * @param subPath the sub-path within the UI assets directory
     * @return a JAX-RS Response containing the asset content with appropriate headers
     * @throws IOException if the asset cannot be read
     */
    public Response getResponse(String subPath, Invoker invoker) throws IOException {
        System.out.println("subPath :" + subPath);
        java.nio.file.Path path = new File(subPath).toPath();
        String mimeType = Files.probeContentType(path);
        System.out.println("mimeType :" + mimeType);

        String cacheControl = "private, max-age=604800, must-revalidate";
        if (subPath.trim().isEmpty() || subPath.equals("index.html") || subPath.startsWith("workspace/")) {
            subPath = "index.html";
            cacheControl = "no-cache, no-store, must-revalidate";
        }

        // No cache for launcher.js and launcher.css to ensure latest version is always loaded
        if (subPath.equals("launcher.js") || subPath.equals("launcher.css")) {
            System.out.println("#####-NO CACHE FOR " + subPath);
            cacheControl = "no-cache, no-store, must-revalidate";
        }

        if (!UI_ASSET_CACHE_MAP.containsKey(subPath)) {
            InputStream inputStream = getClass().getResourceAsStream("/ui/" + subPath);
            if (inputStream == null) {
                return Response.status(Response.Status.NOT_FOUND).entity("UI asset not found: '" + subPath + "'. Verify the file exists in the chatbot UI bundle.").build();
            }
            String content = new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);


            //Need specific check for launcher.js as this call goes from the host site.
            //and we need the FULL URL (protocol + host + path) of Krista not the host site
            if(subPath.endsWith("launcher.js")){
                String baseUrl = getInvokerBaseUrl(invoker, true);
                content = content.replace("__chatbotBasePath__", baseUrl);
            }
            else if (subPath.endsWith("index.html") ||
                    subPath.endsWith(Constants.LAUNCHER_CORE_FILENAME)) {
                content = content.replace("__chatbotBasePath__", getInvokerBaseUrl(invoker, false));
            }

            //added this line to replace the url pattern from ui bundle. vite doesn't support custom path as expected.
            if (subPath.endsWith(".html") || subPath.endsWith(".js")) {
                content = content.replace("/assets/", "chatbot/ui/assets/");
            }
            UI_ASSET_CACHE_MAP.put(subPath, content);
        }
        String content = UI_ASSET_CACHE_MAP.get(subPath);
        // CORS headers are now handled by CorsResponseFilter
        return Response.ok(content)
                .header("Content-type", mimeType)
                .header("Cache-Control", cacheControl)
                .build();
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

            LOGGER.info("#####-CHATBOT-GET INVOKER BASE URL: protocol: {}, host: {}, port: {}, path: {}", protocol, host, port, path);
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
