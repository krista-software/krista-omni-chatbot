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

package app.krista.extensions.essentials.collaboration.omnichatbot.metrics;

import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.api.trace.TracerProvider;
import io.opentelemetry.exporter.otlp.http.trace.OtlpHttpSpanExporter;
import io.opentelemetry.sdk.resources.Resource;
import io.opentelemetry.sdk.trace.SdkTracerProvider;
import io.opentelemetry.sdk.trace.export.BatchSpanProcessor;
import io.opentelemetry.sdk.trace.samplers.Sampler;
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.common.Attributes;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.util.concurrent.TimeUnit;

/**
 * Owns the Omni-Chatbot extension's OpenTelemetry tracer.
 *
 * <p>The platform's telemetry ships logs and metrics to SigNoz but its
 * {@code SdkTracerProvider} is built without a span exporter, so spans created against it
 * are dropped. To make traces actually reach SigNoz from the chatbot without any
 * platform-side change, this class stands up its own {@link SdkTracerProvider} with an
 * {@link OtlpHttpSpanExporter} pointed at the SigNoz OTLP/HTTP endpoint. This mirrors the
 * proven AgenticAI {@code AgenticTracerProvider} approach.
 *
 * <p>Endpoint resolution (first non-blank wins):
 * <ol>
 *   <li>{@code CHATBOT_OTEL_TRACE_ENDPOINT} env var / system property — explicit traces endpoint</li>
 *   <li>{@code OTEL_EXPORTER_OTLP_ENDPOINT} — base OTLP endpoint, {@code /v1/traces} appended</li>
 *   <li>{@code CHATBOT_OTEL_ENDPOINT} — explicit base endpoint, {@code /v1/traces} appended</li>
 *   <li>the platform's configured telemetry endpoint (read reflectively), {@code /v1/traces} appended</li>
 * </ol>
 * <p>If none resolve, traces are emitted into a no-op tracer (kept silent so this is safe to
 * ship in environments without a SigNoz collector).
 *
 * <p>Service name is read from {@code CHATBOT_OTEL_SERVICE_NAME} (default {@code omni-chatbot}).
 *
 * <p>Singleton; lazy-initialised on first {@link #getTracer()} call.
 */
public final class ChatBotTracerProvider {

    private static final Logger LOGGER = LoggerFactory.getLogger(ChatBotTracerProvider.class);

    private static final String INSTRUMENTATION_NAME = "omni-chatbot";
    private static final String SERVICE_NAME_DEFAULT = "omni-chatbot";
    private static final String SERVICE_NAME_ENV = "CHATBOT_OTEL_SERVICE_NAME";
    private static final String TRACE_ENDPOINT_ENV = "CHATBOT_OTEL_TRACE_ENDPOINT";
    private static final String OTEL_BASE_ENDPOINT_ENV = "OTEL_EXPORTER_OTLP_ENDPOINT";
    private static final String CHATBOT_BASE_ENDPOINT_ENV = "CHATBOT_OTEL_ENDPOINT";

    private static volatile ChatBotTracerProvider instance;

    private final Tracer tracer;
    private final boolean exporterConfigured;
    // Held so flush() can drain pending spans at the request/unload boundary. Null when the
    // tracer is configured as no-op (no endpoint).
    private final SdkTracerProvider sdkTracerProvider;

    private ChatBotTracerProvider() {

        String serviceName = firstNonBlank(readConfig(SERVICE_NAME_ENV), SERVICE_NAME_DEFAULT);
        Resource resource = Resource.getDefault().merge(Resource.create(
                Attributes.of(AttributeKey.stringKey("service.name"), serviceName)));

        String tracesEndpoint = resolveTracesEndpoint();
        if (tracesEndpoint == null) {

            LOGGER.warn("[CHATBOT-TELEMETRY] No OTLP traces endpoint configured (set {}, {} or {}). " +
                            "Spans will be created but not exported.",
                    TRACE_ENDPOINT_ENV, OTEL_BASE_ENDPOINT_ENV, CHATBOT_BASE_ENDPOINT_ENV);
            this.tracer = TracerProvider.noop().get(INSTRUMENTATION_NAME);
            this.exporterConfigured = false;
            this.sdkTracerProvider = null;
            return;
        }

        SdkTracerProvider builtProvider;
        Tracer builtTracer;
        boolean configured;
        try {

            OtlpHttpSpanExporter spanExporter = OtlpHttpSpanExporter.builder()
                    .setEndpoint(tracesEndpoint)
                    .setTimeout(Duration.ofSeconds(10))
                    .build();

            builtProvider = SdkTracerProvider.builder()
                    .setResource(resource)
                    // Force-sample every span. The SDK default (parentBased(alwaysOn)) obeys the
                    // parent's sampled flag — and our spans are children of the platform's POST span,
                    // whose tracer is unsampled — so without this our spans would be dropped before
                    // export. alwaysOn ignores the inherited flag so our spans always export.
                    .setSampler(Sampler.alwaysOn())
                    .addSpanProcessor(BatchSpanProcessor.builder(spanExporter)
                            .setScheduleDelay(Duration.ofMillis(500))
                            .build())
                    .build();
            builtTracer = builtProvider.get(INSTRUMENTATION_NAME);
            configured = true;

            LOGGER.info("[CHATBOT-TELEMETRY] Omni-Chatbot OTel tracer initialised - service={}, endpoint={}",
                    serviceName, tracesEndpoint);
        } catch (Throwable t) {

            // Never let tracer setup failure propagate — fall back to a no-op tracer so the
            // extension keeps working even if the OTLP exporter can't be built on this runtime.
            LOGGER.warn("[CHATBOT-TELEMETRY] Tracer init failed; falling back to no-op tracer: {}", t.toString());
            builtProvider = null;
            builtTracer = TracerProvider.noop().get(INSTRUMENTATION_NAME);
            configured = false;
        }
        this.sdkTracerProvider = builtProvider;
        this.tracer = builtTracer;
        this.exporterConfigured = configured;

        // Best-effort flush on JVM shutdown so terminal spans are not lost. Uses a final
        // local so the lambda capture is valid; only registered when the exporter is live.
        if (this.sdkTracerProvider != null) {

            final SdkTracerProvider providerForShutdown = this.sdkTracerProvider;
            Runtime.getRuntime().addShutdownHook(new Thread(() ->
                    providerForShutdown.shutdown().join(5, TimeUnit.SECONDS),
                    "chatbot-otel-shutdown"));
        }
    }

    public static ChatBotTracerProvider getInstance() {

        if (instance == null) {

            synchronized (ChatBotTracerProvider.class) {

                if (instance == null) {

                    instance = new ChatBotTracerProvider();
                }
            }
        }
        return instance;
    }

    public Tracer getTracer() {

        return tracer;
    }

    public boolean isExporterConfigured() {

        return exporterConfigured;
    }

    /**
     * Drains the BatchSpanProcessor synchronously so spans created so far reach the collector.
     * Safe to call from any thread. No-op when the tracer is no-op (no endpoint). Bounded by
     * {@code timeoutMillis} so a slow/unreachable collector cannot stall the caller.
     */
    public void flush(long timeoutMillis) {

        if (sdkTracerProvider == null) {

            return;
        }
        try {

            sdkTracerProvider.forceFlush().join(timeoutMillis, TimeUnit.MILLISECONDS);
        } catch (Throwable t) {

            LOGGER.debug("[CHATBOT-TELEMETRY] forceFlush suppressed: {}", t.getMessage());
        }
    }

    private static String resolveTracesEndpoint() {

        String explicit = readConfig(TRACE_ENDPOINT_ENV);
        if (isPresent(explicit)) {

            return explicit;
        }
        String base = firstNonBlank(
                readConfig(OTEL_BASE_ENDPOINT_ENV),
                readConfig(CHATBOT_BASE_ENDPOINT_ENV),
                readPlatformTelemetryEndpoint());
        if (!isPresent(base)) {

            return null;
        }
        String trimmed = base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
        return trimmed + "/v1/traces";
    }

    /**
     * Reflectively reads the platform's existing telemetry endpoint from
     * {@code com.krista.core.spec.Spec.getTelemetryAccess().endpoint()} so the chatbot inherits
     * the same SigNoz endpoint the platform already uses for logs/metrics — no extra env var
     * needed. Reflection avoids a build-time dependency on platform-internal classes; if the
     * class is unavailable at runtime the fallback simply returns {@code null}.
     */
    private static String readPlatformTelemetryEndpoint() {

        try {

            Class<?> specClass = Class.forName("com.krista.core.spec.Spec");
            Object specTelemetry = specClass.getMethod("getTelemetryAccess").invoke(null);
            if (specTelemetry == null) {

                return null;
            }
            Object endpoint = specTelemetry.getClass().getMethod("endpoint").invoke(specTelemetry);
            return endpoint != null ? endpoint.toString() : null;
        } catch (Throwable t) {

            LOGGER.debug("[CHATBOT-TELEMETRY] Could not read platform Spec.getTelemetryAccess().endpoint(): {}",
                    t.getMessage());
            return null;
        }
    }

    private static String readConfig(String envName) {

        String fromEnv = System.getenv(envName);
        if (isPresent(fromEnv)) {

            return fromEnv;
        }
        String propName = envName.toLowerCase().replace('_', '.');
        return System.getProperty(propName);
    }

    private static boolean isPresent(String s) {

        return s != null && !s.isBlank();
    }

    private static String firstNonBlank(String... values) {

        if (values == null) {

            return null;
        }
        for (String v : values) {

            if (isPresent(v)) {

                return v;
            }
        }
        return null;
    }
}
