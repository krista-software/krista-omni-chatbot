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

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerResponseContext;
import javax.ws.rs.core.MultivaluedHashMap;
import javax.ws.rs.core.MultivaluedMap;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.UriInfo;
import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

/**
 * Comprehensive unit tests for CorsResponseFilter class.
 * Tests cover:
 * - CORS header addition to responses
 * - Preflight OPTIONS request handling
 * - Filter behavior for different HTTP methods
 * - Filter behavior for different paths
 * - Header values validation
 * - Multiple invocations
 * - Error handling
 */
@DisplayName("CorsResponseFilter Tests")
class CorsResponseFilterTest {

    private CorsResponseFilter filter;

    @Mock
    private ContainerRequestContext requestContext;

    @Mock
    private ContainerResponseContext responseContext;

    @Mock
    private UriInfo uriInfo;

    private MultivaluedMap<String, Object> headers;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        filter = new CorsResponseFilter();
        headers = new MultivaluedHashMap<>();

        // Setup default mock behavior
        when(responseContext.getHeaders()).thenReturn(headers);
        when(requestContext.getUriInfo()).thenReturn(uriInfo);
        when(uriInfo.getPath()).thenReturn("/test/path");
        when(requestContext.getMethod()).thenReturn("GET");
    }

    @Nested
    @DisplayName("Preflight OPTIONS Request Tests")
    class PreflightOptionsTests {

        @Test
        @DisplayName("Should abort OPTIONS request with 200 and CORS headers")
        void shouldAbortOptionsRequestWithCorsHeaders() throws IOException {
            // Given
            when(requestContext.getMethod()).thenReturn("OPTIONS");

            // When
            filter.filter(requestContext);

            // Then
            ArgumentCaptor<Response> responseCaptor = ArgumentCaptor.forClass(Response.class);
            verify(requestContext).abortWith(responseCaptor.capture());

            Response response = responseCaptor.getValue();
            assertThat(response.getStatus()).isEqualTo(200);
            assertThat(response.getHeaderString("Access-Control-Allow-Origin")).isEqualTo("*");
            assertThat(response.getHeaderString("Access-Control-Allow-Headers"))
                    .isEqualTo("Content-Type, Authorization, X-Krista-Original-URI, Chatbot-Session-Id, X-Krista-Context");
            assertThat(response.getHeaderString("Access-Control-Allow-Methods"))
                    .isEqualTo("GET, POST, PUT, DELETE, OPTIONS");
        }

        @Test
        @DisplayName("Should handle lowercase OPTIONS method")
        void shouldHandleLowercaseOptions() throws IOException {
            // Given
            when(requestContext.getMethod()).thenReturn("options");

            // When
            filter.filter(requestContext);

            // Then
            verify(requestContext).abortWith(any(Response.class));
        }

        @Test
        @DisplayName("Should not abort non-OPTIONS requests")
        void shouldNotAbortNonOptionsRequests() throws IOException {
            // Given
            when(requestContext.getMethod()).thenReturn("GET");

            // When
            filter.filter(requestContext);

            // Then
            verify(requestContext, never()).abortWith(any(Response.class));
        }

        @ParameterizedTest
        @ValueSource(strings = {"GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"})
        @DisplayName("Should not abort any non-OPTIONS HTTP method")
        void shouldNotAbortNonOptionsMethods(String method) throws IOException {
            // Given
            when(requestContext.getMethod()).thenReturn(method);

            // When
            filter.filter(requestContext);

            // Then
            verify(requestContext, never()).abortWith(any(Response.class));
        }

        @ParameterizedTest
        @ValueSource(strings = {
                "/config",
                "/session",
                "/supportedLanguages",
                "/inboxes/123/messages",
                "/entities/search"
        })
        @DisplayName("Should handle OPTIONS preflight for all API paths")
        void shouldHandleOptionsForAllPaths(String path) throws IOException {
            // Given
            when(requestContext.getMethod()).thenReturn("OPTIONS");
            when(uriInfo.getPath()).thenReturn(path);

            // When
            filter.filter(requestContext);

            // Then
            verify(requestContext).abortWith(any(Response.class));
        }
    }

    @Nested
    @DisplayName("CORS Header Addition Tests")
    class CorsHeaderAdditionTests {

        @Test
        @DisplayName("Should add all required CORS headers to response")
        void shouldAddAllCorsHeaders() throws IOException {
            // When
            filter.filter(requestContext, responseContext);

            // Then
            assertThat(headers).containsKey("Access-Control-Allow-Origin");
            assertThat(headers).containsKey("Access-Control-Allow-Headers");
            assertThat(headers).containsKey("Access-Control-Allow-Methods");
        }

        @Test
        @DisplayName("Should set Access-Control-Allow-Origin to *")
        void shouldSetAllowOriginToWildcard() throws IOException {
            // When
            filter.filter(requestContext, responseContext);

            // Then
            assertThat(headers.get("Access-Control-Allow-Origin"))
                    .containsExactly("*");
        }

        @Test
        @DisplayName("Should set Access-Control-Allow-Headers correctly")
        void shouldSetAllowHeadersCorrectly() throws IOException {
            // When
            filter.filter(requestContext, responseContext);

            // Then
            assertThat(headers.get("Access-Control-Allow-Headers"))
                    .containsExactly("Content-Type, Authorization, X-Krista-Original-URI, Chatbot-Session-Id, X-Krista-Context");
        }

        @Test
        @DisplayName("Should set Access-Control-Allow-Methods correctly")
        void shouldSetAllowMethodsCorrectly() throws IOException {
            // When
            filter.filter(requestContext, responseContext);

            // Then
            assertThat(headers.get("Access-Control-Allow-Methods"))
                    .containsExactly("GET, POST, PUT, DELETE, OPTIONS");
        }

        @Test
        @DisplayName("Should add headers even when response already has other headers")
        void shouldAddHeadersToExistingHeaders() throws IOException {
            // Given
            headers.add("Content-Type", "application/json");
            headers.add("Cache-Control", "no-cache");

            // When
            filter.filter(requestContext, responseContext);

            // Then
            assertThat(headers).hasSize(5); // 2 existing + 3 CORS headers
            assertThat(headers).containsKey("Content-Type");
            assertThat(headers).containsKey("Cache-Control");
            assertThat(headers).containsKey("Access-Control-Allow-Origin");
            assertThat(headers).containsKey("Access-Control-Allow-Headers");
            assertThat(headers).containsKey("Access-Control-Allow-Methods");
        }
    }

    @Nested
    @DisplayName("Different HTTP Methods Tests")
    class HttpMethodsTests {

        @ParameterizedTest
        @ValueSource(strings = {"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"})
        @DisplayName("Should add CORS headers for all HTTP methods")
        void shouldAddCorsHeadersForAllMethods(String method) throws IOException {
            // Given
            when(requestContext.getMethod()).thenReturn(method);

            // When
            filter.filter(requestContext, responseContext);

            // Then
            assertThat(headers).containsKey("Access-Control-Allow-Origin");
            assertThat(headers).containsKey("Access-Control-Allow-Headers");
            assertThat(headers).containsKey("Access-Control-Allow-Methods");
        }
    }

    @Nested
    @DisplayName("Different Paths Tests")
    class PathsTests {

        @ParameterizedTest
        @ValueSource(strings = {
                "/config",
                "/session",
                "/supportedLanguages",
                "/inboxes/123/messages",
                "/entities/search",
                "/sendTranscript",
                "/ui/index.html",
                "/integration"
        })
        @DisplayName("Should add CORS headers for all API paths")
        void shouldAddCorsHeadersForAllPaths(String path) throws IOException {
            // Given
            when(uriInfo.getPath()).thenReturn(path);

            // When
            filter.filter(requestContext, responseContext);

            // Then
            assertThat(headers).containsKey("Access-Control-Allow-Origin");
            assertThat(headers).containsKey("Access-Control-Allow-Headers");
            assertThat(headers).containsKey("Access-Control-Allow-Methods");
        }
    }

    @Nested
    @DisplayName("Multiple Invocations Tests")
    class MultipleInvocationsTests {

        @Test
        @DisplayName("Should add headers consistently across multiple invocations")
        void shouldAddHeadersConsistently() throws IOException {
            // When - First invocation
            filter.filter(requestContext, responseContext);
            MultivaluedMap<String, Object> firstHeaders = new MultivaluedHashMap<>(headers);

            // When - Second invocation with new response context
            headers.clear();
            filter.filter(requestContext, responseContext);

            // Then - Headers should be identical
            assertThat(headers).isEqualTo(firstHeaders);
        }

        @Test
        @DisplayName("Should handle multiple calls with same response context")
        void shouldHandleMultipleCallsWithSameContext() throws IOException {
            // When - Multiple invocations
            filter.filter(requestContext, responseContext);
            filter.filter(requestContext, responseContext);
            filter.filter(requestContext, responseContext);

            // Then - Headers should be present (may have duplicates depending on implementation)
            assertThat(headers).containsKey("Access-Control-Allow-Origin");
            assertThat(headers).containsKey("Access-Control-Allow-Headers");
            assertThat(headers).containsKey("Access-Control-Allow-Methods");
        }
    }

    @Nested
    @DisplayName("Edge Cases and Error Handling Tests")
    class EdgeCasesTests {

        @Test
        @DisplayName("Should handle null path gracefully")
        void shouldHandleNullPath() throws IOException {
            // Given
            when(uriInfo.getPath()).thenReturn(null);

            // When
            filter.filter(requestContext, responseContext);

            // Then - Should still add headers
            assertThat(headers).containsKey("Access-Control-Allow-Origin");
            assertThat(headers).containsKey("Access-Control-Allow-Headers");
            assertThat(headers).containsKey("Access-Control-Allow-Methods");
        }

        @Test
        @DisplayName("Should handle empty path gracefully")
        void shouldHandleEmptyPath() throws IOException {
            // Given
            when(uriInfo.getPath()).thenReturn("");

            // When
            filter.filter(requestContext, responseContext);

            // Then - Should still add headers
            assertThat(headers).containsKey("Access-Control-Allow-Origin");
            assertThat(headers).containsKey("Access-Control-Allow-Headers");
            assertThat(headers).containsKey("Access-Control-Allow-Methods");
        }

        @Test
        @DisplayName("Should verify getHeaders is called on response context")
        void shouldCallGetHeadersOnResponseContext() throws IOException {
            // When
            filter.filter(requestContext, responseContext);

            // Then
            verify(responseContext, atLeastOnce()).getHeaders();
        }

        @Test
        @DisplayName("Should verify getUriInfo is called on request context")
        void shouldCallGetUriInfoOnRequestContext() throws IOException {
            // When
            filter.filter(requestContext, responseContext);

            // Then
            verify(requestContext, atLeastOnce()).getUriInfo();
        }
    }

    @Nested
    @DisplayName("Integration Tests")
    class IntegrationTests {

        @Test
        @DisplayName("Should work with real MultivaluedHashMap")
        void shouldWorkWithRealMultivaluedHashMap() throws IOException {
            // Given - Using real MultivaluedHashMap
            MultivaluedMap<String, Object> realHeaders = new MultivaluedHashMap<>();
            when(responseContext.getHeaders()).thenReturn(realHeaders);

            // When
            filter.filter(requestContext, responseContext);

            // Then
            assertThat(realHeaders.get("Access-Control-Allow-Origin")).containsExactly("*");
            assertThat(realHeaders.get("Access-Control-Allow-Headers")).containsExactly("Content-Type, Authorization, X-Krista-Original-URI, Chatbot-Session-Id, X-Krista-Context");
            assertThat(realHeaders.get("Access-Control-Allow-Methods")).containsExactly("GET, POST, PUT, DELETE, OPTIONS");
        }

        @Test
        @DisplayName("Should not throw exception during normal operation")
        void shouldNotThrowException() {
            // When/Then - Should not throw any exception
            org.junit.jupiter.api.Assertions.assertDoesNotThrow(() ->
                filter.filter(requestContext, responseContext)
            );
        }
    }
}
