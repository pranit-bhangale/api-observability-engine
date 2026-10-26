package io.github.pranit.annotation;

/**
 * Determines the scope and depth of tracing for a method or class.
 * <ul>
 *   <li>{@link #AUTO} - Infers category from Spring stereotype</li>
 *   <li>{@link #CONTROLLER} - Deep capture: method + all called bean methods</li>
 *   <li>{@link #SERVICE} - Only the annotated service method</li>
 *   <li>{@link #REPOSITORY} - Only the annotated repository method</li>
 *   <li>{@link #LLM} - LLM API call method</li>
 * </ul>
 */
public enum ActionOn {

    /**
     * Automatically infer category from the class annotation:
     */
    AUTO,

    /**
     * Deep capture: this method and every bean method it calls
     * are recorded as child spans
     * with traceId/spanId/parentSpanId, arguments and results.
     */
    CONTROLLER,

    /**
     * Service-layer business method: only the annotated method itself is recorded.
     * Nested calls within the service are not captured as spans.
     */
    SERVICE,

    /**
     * Repository/Data-access method: only the annotated method itself is recorded.
     * No nested calls inside the repository are captured.
     */
    REPOSITORY,

    /**
     * Large Language Model API call: only the annotated method itself is recorded.
     */
    LLM;

    /**
     * Returns {@code true} only for {@link #CONTROLLER}, indicating that nested
     * bean calls should be captured as child spans.
     */
    public boolean isDeep() {
        return this == CONTROLLER;
    }
}
