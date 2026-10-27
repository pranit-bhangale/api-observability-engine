package io.github.pranit.model;

import java.util.Map;

/**
 * Metadata representing an HTTP endpoint discovered on application startup with @Observe / @Trace.
 */
public record ObservedEndpoint(
        String id,
        String method,
        String path,
        String controllerName,
        String methodName,
        String description,
        String requestType,
        String body,
        Map<String, String> headers
) {
}
