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

package app.krista.extensions.essentials.collaboration.omnichatbot.concurrency;

import app.krista.ksdk.telemetry.TelemetryMetrics;

import java.util.Map;

/**
 * No-op {@link TelemetryMetrics} for tests — records nothing. The concurrency
 * logic must behave identically whether or not telemetry does anything.
 */
public class NoOpTelemetryMetrics implements TelemetryMetrics {

    @Override
    public void incrementCounter(String name) {
    }

    @Override
    public void incrementCounter(String name, long value) {
    }

    @Override
    public void incrementCounter(String name, long value, Map<String, String> attributes) {
    }

    @Override
    public void recordDuration(String name, long millis) {
    }

    @Override
    public void recordDuration(String name, long millis, Map<String, String> attributes) {
    }

    @Override
    public void observeGauge(String name, double value) {
    }

    @Override
    public void observeGauge(String name, double value, Map<String, String> attributes) {
    }

    @Override
    public boolean sendAlertEmail(Exception exception, String errorMessage, Map<String, Object> errorMetadata, Map<String, Object> requestDetails) {
        return false;
    }
}
