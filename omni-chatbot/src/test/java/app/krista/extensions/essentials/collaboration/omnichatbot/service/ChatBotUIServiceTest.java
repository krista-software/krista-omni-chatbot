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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Test class for ChatBotUIService
 * Tests the getInvokerBaseUrl method with both includeHostAndProtocol modes
 */
class ChatBotUIServiceTest {

    private ChatBotUIService chatBotUIService;

    @Mock
    private Invoker invoker;

    @Mock
    private RoutingInfo routingInfo;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        chatBotUIService = new ChatBotUIService();
        
        // Setup default mock behavior
        when(invoker.getRoutingInfo()).thenReturn(routingInfo);
    }

    @Nested
    @DisplayName("getInvokerBaseUrl with includeHostAndProtocol = true (Full URL)")
    class FullUrlTests {

        @Test
        @DisplayName("Should return full URL with protocol, host, and path")
        void testFullUrl_Standard() throws Exception {
            // Given
            String routingURL = "https://extension.qa-in.eng.krista.app/extension/api/sYB0OLxfjv8pkaWe_sjO9Yg_e_e";
            when(routingInfo.getRoutingURL(HttpProtocol.PROTOCOL_NAME, RoutingInfo.Type.APPLIANCE))
                    .thenReturn(routingURL);

            // When
            String result = invokeGetInvokerBaseUrl(invoker, true);

            // Then
            String expected = "https://extension.qa-in.eng.krista.app/extension/api/sYB0OLxfjv8pkaWe_sjO9Yg_e_e/";
            assertEquals(expected, result, "Should return full URL with trailing slash");
        }

        @Test
        @DisplayName("Should handle URL with non-standard port")
        void testFullUrl_NonStandardPort() throws Exception {
            // Given
            String routingURL = "https://extension.qa-in.eng.krista.app:8443/extension/api/test123";
            when(routingInfo.getRoutingURL(HttpProtocol.PROTOCOL_NAME, RoutingInfo.Type.APPLIANCE))
                    .thenReturn(routingURL);

            // When
            String result = invokeGetInvokerBaseUrl(invoker, true);

            // Then
            String expected = "https://extension.qa-in.eng.krista.app:8443/extension/api/test123/";
            assertEquals(expected, result, "Should include non-standard port in full URL");
        }

        @Test
        @DisplayName("Should not include standard HTTPS port (443)")
        void testFullUrl_StandardHttpsPort() throws Exception {
            // Given
            String routingURL = "https://extension.qa-in.eng.krista.app:443/extension/api/test";
            when(routingInfo.getRoutingURL(HttpProtocol.PROTOCOL_NAME, RoutingInfo.Type.APPLIANCE))
                    .thenReturn(routingURL);

            // When
            String result = invokeGetInvokerBaseUrl(invoker, true);

            // Then
            String expected = "https://extension.qa-in.eng.krista.app/extension/api/test/";
            assertEquals(expected, result, "Should not include standard HTTPS port 443");
        }

        @Test
        @DisplayName("Should not include standard HTTP port (80)")
        void testFullUrl_StandardHttpPort() throws Exception {
            // Given
            String routingURL = "http://extension.qa-in.eng.krista.app:80/extension/api/test";
            when(routingInfo.getRoutingURL(HttpProtocol.PROTOCOL_NAME, RoutingInfo.Type.APPLIANCE))
                    .thenReturn(routingURL);

            // When
            String result = invokeGetInvokerBaseUrl(invoker, true);

            // Then
            String expected = "http://extension.qa-in.eng.krista.app/extension/api/test/";
            assertEquals(expected, result, "Should not include standard HTTP port 80");
        }

        @Test
        @DisplayName("Should handle URL with node prefix in path")
        void testFullUrl_WithNodePrefix() throws Exception {
            // Given
            String routingURL = "https://extension.aws-dev02.eng.krista.app/node1/extension/api/SLZN4qLgFCU9lbKYxEg3WQ_e_e";
            when(routingInfo.getRoutingURL(HttpProtocol.PROTOCOL_NAME, RoutingInfo.Type.APPLIANCE))
                    .thenReturn(routingURL);

            // When
            String result = invokeGetInvokerBaseUrl(invoker, true);

            // Then
            String expected = "https://extension.aws-dev02.eng.krista.app/node1/extension/api/SLZN4qLgFCU9lbKYxEg3WQ_e_e/";
            assertEquals(expected, result, "Should handle node prefix in path correctly");
        }

        @Test
        @DisplayName("Should handle localhost")
        void testFullUrl_Localhost() throws Exception {
            // Given
            String routingURL = "http://localhost:8080/extension/api/test";
            when(routingInfo.getRoutingURL(HttpProtocol.PROTOCOL_NAME, RoutingInfo.Type.APPLIANCE))
                    .thenReturn(routingURL);

            // When
            String result = invokeGetInvokerBaseUrl(invoker, true);

            // Then
            String expected = "http://localhost:8080/extension/api/test/";
            assertEquals(expected, result, "Should handle localhost correctly");
        }

        @Test
        @DisplayName("Should add trailing slash if not present")
        void testFullUrl_AddTrailingSlash() throws Exception {
            // Given
            String routingURL = "https://extension.qa-in.eng.krista.app/extension/api/test";
            when(routingInfo.getRoutingURL(HttpProtocol.PROTOCOL_NAME, RoutingInfo.Type.APPLIANCE))
                    .thenReturn(routingURL);

            // When
            String result = invokeGetInvokerBaseUrl(invoker, true);

            // Then
            assertTrue(result.endsWith("/"), "Should add trailing slash");
        }

        @Test
        @DisplayName("Should preserve trailing slash if already present")
        void testFullUrl_PreserveTrailingSlash() throws Exception {
            // Given
            String routingURL = "https://extension.qa-in.eng.krista.app/extension/api/test/";
            when(routingInfo.getRoutingURL(HttpProtocol.PROTOCOL_NAME, RoutingInfo.Type.APPLIANCE))
                    .thenReturn(routingURL);

            // When
            String result = invokeGetInvokerBaseUrl(invoker, true);

            // Then
            String expected = "https://extension.qa-in.eng.krista.app/extension/api/test/";
            assertEquals(expected, result, "Should preserve existing trailing slash");
            assertFalse(result.endsWith("//"), "Should not have double trailing slash");
        }
    }

    @Nested
    @DisplayName("getInvokerBaseUrl with includeHostAndProtocol = false (Path Only)")
    class PathOnlyTests {

        @Test
        @DisplayName("Should return path only without protocol and host")
        void testPathOnly_Standard() throws Exception {
            // Given
            String routingURL = "https://extension.qa-in.eng.krista.app/extension/api/sYB0OLxfjv8pkaWe_sjO9Yg_e_e";
            when(routingInfo.getRoutingURL(HttpProtocol.PROTOCOL_NAME, RoutingInfo.Type.APPLIANCE))
                    .thenReturn(routingURL);

            // When
            String result = invokeGetInvokerBaseUrl(invoker, false);

            // Then
            String expected = "/extension/api/sYB0OLxfjv8pkaWe_sjO9Yg_e_e/";
            assertEquals(expected, result, "Should return path only with trailing slash");
        }

        @Test
        @DisplayName("Should return path only with node prefix")
        void testPathOnly_WithNodePrefix() throws Exception {
            // Given
            String routingURL = "https://extension.aws-dev02.eng.krista.app/node1/extension/api/SLZN4qLgFCU9lbKYxEg3WQ_e_e";
            when(routingInfo.getRoutingURL(HttpProtocol.PROTOCOL_NAME, RoutingInfo.Type.APPLIANCE))
                    .thenReturn(routingURL);

            // When
            String result = invokeGetInvokerBaseUrl(invoker, false);

            // Then
            String expected = "/node1/extension/api/SLZN4qLgFCU9lbKYxEg3WQ_e_e/";
            assertEquals(expected, result, "Should return path with node prefix");
        }

        @Test
        @DisplayName("Should add trailing slash to path if not present")
        void testPathOnly_AddTrailingSlash() throws Exception {
            // Given
            String routingURL = "https://extension.qa-in.eng.krista.app/extension/api/test";
            when(routingInfo.getRoutingURL(HttpProtocol.PROTOCOL_NAME, RoutingInfo.Type.APPLIANCE))
                    .thenReturn(routingURL);

            // When
            String result = invokeGetInvokerBaseUrl(invoker, false);

            // Then
            assertTrue(result.endsWith("/"), "Should add trailing slash to path");
            assertTrue(result.startsWith("/"), "Should start with slash");
        }

        @Test
        @DisplayName("Should preserve trailing slash in path if already present")
        void testPathOnly_PreserveTrailingSlash() throws Exception {
            // Given
            String routingURL = "https://extension.qa-in.eng.krista.app/extension/api/test/";
            when(routingInfo.getRoutingURL(HttpProtocol.PROTOCOL_NAME, RoutingInfo.Type.APPLIANCE))
                    .thenReturn(routingURL);

            // When
            String result = invokeGetInvokerBaseUrl(invoker, false);

            // Then
            String expected = "/extension/api/test/";
            assertEquals(expected, result, "Should preserve existing trailing slash");
            assertFalse(result.endsWith("//"), "Should not have double trailing slash");
        }

        @Test
        @DisplayName("Should not include port in path-only mode")
        void testPathOnly_NoPort() throws Exception {
            // Given
            String routingURL = "https://extension.qa-in.eng.krista.app:8443/extension/api/test";
            when(routingInfo.getRoutingURL(HttpProtocol.PROTOCOL_NAME, RoutingInfo.Type.APPLIANCE))
                    .thenReturn(routingURL);

            // When
            String result = invokeGetInvokerBaseUrl(invoker, false);

            // Then
            String expected = "/extension/api/test/";
            assertEquals(expected, result, "Should not include port in path-only mode");
            assertFalse(result.contains(":8443"), "Should not contain port number");
        }
    }

    @Nested
    @DisplayName("Error Handling")
    class ErrorHandlingTests {

        @Test
        @DisplayName("Should throw IllegalStateException on malformed URL")
        void testMalformedUrl() throws Exception {
            // Given - URI with illegal characters that will cause URISyntaxException
            when(routingInfo.getRoutingURL(HttpProtocol.PROTOCOL_NAME, RoutingInfo.Type.APPLIANCE))
                    .thenReturn("https://example.com/path with spaces");

            // When & Then
            try {
                invokeGetInvokerBaseUrl(invoker, true);
                fail("Should have thrown IllegalStateException for malformed URL");
            } catch (Exception e) {
                // Reflection wraps the exception in InvocationTargetException
                Throwable cause = e.getCause();
                assertNotNull(cause, "Should have a cause");
                assertEquals(IllegalStateException.class, cause.getClass(),
                    "Cause should be IllegalStateException");
            }
        }
    }

    // ========== Helper Methods ==========

    /**
     * Helper method to invoke private getInvokerBaseUrl method using reflection
     */
    private String invokeGetInvokerBaseUrl(Invoker invoker, boolean includeHostAndProtocol) throws Exception {
        Method method = ChatBotUIService.class.getDeclaredMethod("getInvokerBaseUrl", Invoker.class, boolean.class);
        method.setAccessible(true);
        return (String) method.invoke(chatBotUIService, invoker, includeHostAndProtocol);
    }
}

