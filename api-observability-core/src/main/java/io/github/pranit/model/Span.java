package io.github.pranit.model;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.pranit.annotation.ActionOn;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Represents a single method call inside a trace.
 * <p>
 * Each span captures the essential metadata of a called method:
 * its identity (trace/span IDs), category, name, class, method,
 * timing information, and captured arguments/return values.
 * </p>
 * <p>
 * Thread Affinity: Created and managed by TraceContext which uses ThreadLocal
 * to ensure each thread has its own independent trace context.
 * </p>
 *
 * @see TraceContext The per-thread trace state that holds all spans
 * @see TraceRecord The aggregated record written at trace end
 */
public final class Span {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    /**
     * Unique identifier for this trace (generated once per root method).
     */
    public final String traceId;
    /**
     * Unique identifier for this span within its trace.
     */
    public final String spanId;
    /**
     * Identifier of the parent span, or {@code null} if this is a root span.
     */
    public final String parentSpanId;
    /**
     * Nesting depth of this span (0 = root).
     */
    public final int depth;
    /**
     * Category of the call: {@link ActionOn#AUTO}, {@link ActionOn#CONTROLLER},
     * {@link ActionOn#SERVICE}, {@link ActionOn#REPOSITORY}, or {@link ActionOn#LLM}.
     */
    public final ActionOn category;
    /**
     * Human-readable name of the span (typically method name).
     */
    public final String name;
    /**
     * Fully qualified class name where the traced method resides.
     */
    public final String className;
    /**
     * Method name being traced.
     */
    public final String method;
    /**
     * Thread name executing the span.
     */
    public final String thread;
    /**
     * Absolute start time of the span.
     */
    public final Instant startTime;
    /**
     * Nano-time snapshot at span creation, used for high-resolution offset calculation.
     */
    public final long startNanos;
    /**
     * Total duration in milliseconds (filled when the span is closed).
     */
    public double durationMs;
    /**
     * Offset of this span from the root in milliseconds.
     */
    public double offsetMs;
    /**
     * Percentage of total offset from the root (0.0–99.5).
     */
    public double offsetPct;
    /**
     * Percentage of total width representing this span's duration (0.5–100.0).
     */
    public double widthPct;
    /**
     * Final status of the span: {@code "OK"} or {@code "ERROR"}.
     */
    public String status = "OK";
    /**
     * JSON text (object of argName -> value) or {@code null} if not captured.
     */
    public String args;
    /**
     * JSON text of the method return value or {@code null} if not captured.
     */
    public String result;
    /**
     * Detailed captured input arguments.
     */
    public List<ArgumentDetail> inputArgs;
    /**
     * Detailed captured output argument / return value.
     */
    public ReturnDetail outputArgs;
    /**
     * Error description if the method threw an exception, or {@code null }
     */
    public String error;
    public String errorMessage;
    public String errorDetail;

    /**
     * Creates a new span with the given metadata.
     *
     * @param traceId      unique trace identifier
     * @param spanId       unique span identifier within the trace
     * @param parentSpanId parent span identifier, or {@code null} for root
     * @param depth        nesting depth (0 for root)
     * @param category     {@link ActionOn} category of the call
     * @param name         human-readable span name
     * @param className    fully qualified class name
     * @param method       method name
     */
    public Span(String traceId, String spanId, String parentSpanId, int depth, ActionOn category,
                String name, String className, String method) {
        this.traceId = traceId;
        this.spanId = spanId;
        this.parentSpanId = parentSpanId;
        this.depth = depth;
        this.category = category;
        this.name = name;
        this.className = className;
        this.method = method;
        this.thread = Thread.currentThread().getName();
        this.startTime = Instant.now();
        this.startNanos = System.nanoTime();
    }

    private static Object toJsonValue(String json) {
        if (json == null || json.isBlank() || "null".equals(json)) return null;
        try {
            return MAPPER.readTree(json);
        } catch (Exception e) {
            return json;
        }
    }

    /**
     * Returns the duration of this span in milliseconds.
     * Calculated as finishTime - startTime.
     *
     * @return duration in milliseconds
     */
    public double getDurationMs() {
        return durationMs;
    }

    /**
     * Returns the start time of this span.
     *
     * @return start time as Instant
     */
    public Instant getStartTime() {
        return startTime;
    }

    /**
     * Returns the start time as a long (nanoseconds).
     *
     * @return startNanos
     */
    public long getStartNanos() {
        return startNanos;
    }

    /**
     * Returns the parent span ID, or {@code null} if this is a root span.
     *
     * @return parent span ID or null
     */
    public String getParentSpanId() {
        return parentSpanId;
    }

    /**
     * Returns the span ID.
     *
     * @return span ID
     */
    public String getSpanId() {
        return spanId;
    }

    /**
     * Returns the trace ID.
     *
     * @return trace ID
     */
    public String getTraceId() {
        return traceId;
    }

    /**
     * Returns the category of this span.
     *
     * @return ActionOn category
     */
    public ActionOn getCategory() {
        return category;
    }

    /**
     * Returns the name of this span.
     *
     * @return span name
     */
    public String getName() {
        return name;
    }

    /**
     * Returns the method name.
     *
     * @return method name
     */
    public String getMethod() {
        return method;
    }

    /**
     * Returns the URI (for controller spans).
     *
     * @return URI string, or empty if not a controller span
     */
    public String getUri() {
        // URI is typically set by the controller layer
        return "";
    }

    /**
     * Returns the thread name executing this span.
     *
     * @return thread name
     */
    public String getThread() {
        return thread;
    }

    /**
     * Returns the depth of this span (0 = root).
     *
     * @return depth
     */
    public int getDepth() {
        return depth;
    }

    /**
     * Checks if this span is the root span (no parent).
     *
     * @return true if root span
     */
    public boolean isRoot() {
        return parentSpanId == null;
    }

    /**
     * Checks if this span has a parent span.
     *
     * @return true if not root
     */
    public boolean isChild() {
        return parentSpanId != null;
    }

    /**
     * Checks if this span failed (status is "ERROR").
     *
     * @return true if the call failed
     */
    public boolean isFailed() {
        return "ERROR".equals(status);
    }

    public String getClassName() {
        return className;
    }

    public String getStatus() {
        return status;
    }

    public double getOffsetMs() {
        return offsetMs;
    }

    public double getOffsetPct() {
        return offsetPct;
    }

    public double getWidthPct() {
        return widthPct;
    }

    public String getArgs() {
        return args;
    }

    public String getResult() {
        return result;
    }

    public String getError() {
        return error;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public String getErrorDetail() {
        return errorDetail;
    }

    public List<ArgumentDetail> getInputArgs() {
        return inputArgs != null ? inputArgs : List.of();
    }

    public ReturnDetail getOutputArgs() {
        return outputArgs;
    }

    /**
     * Converts this span to a JSON-compatible map with all the required fields.
     *
     * @return Map<String, Object> suitable for JSON serialization
     */
    public Map<String, Object> toMap() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("traceId", traceId);
        m.put("spanId", spanId);
        m.put("parentSpanId", parentSpanId);
        m.put("depth", depth);
        m.put("category", category);
        m.put("name", name);
        m.put("class", className);
        m.put("method", method);
        m.put("thread", thread);
        m.put("startTime", startTime != null ? startTime.toString() : null);
        m.put("startNanos", startNanos);
        m.put("durationMs", durationMs);
        m.put("offsetMs", offsetMs);
        m.put("offsetPct", offsetPct);
        m.put("widthPct", widthPct);
        m.put("status", status);
        if (inputArgs != null) {
            m.put("inputArgs", inputArgs.stream().map(ArgumentDetail::toMap).toList());
        }
        if (outputArgs != null) {
            m.put("outputArgs", outputArgs.toMap());
        }
        if (args != null) {
            m.put("args", toJsonValue(args));
        }
        if (result != null) {
            m.put("result", toJsonValue(result));
        }
        m.put("error", error);
        m.put("errorMessage", errorMessage);
        m.put("errorDetail", errorDetail);
        return m;
    }
}