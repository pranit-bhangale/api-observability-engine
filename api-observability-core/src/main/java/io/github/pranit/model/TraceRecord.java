package io.github.pranit.model;

import io.github.pranit.annotation.ActionOn;

import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Record of a completed trace, built when the root method returns.
 */
public final class TraceRecord {

    /**
     * Formatter for human-readable start-time labels.
     */
    private static final DateTimeFormatter LABEL = DateTimeFormatter
            .ofPattern("yyyy-MM-dd HH:mm:ss.SSS")
            .withZone(java.time.ZoneId.systemDefault());

    /**
     * Unique identifier for the trace.
     */
    public final String traceId;

    /**
     * Name of the root span (typically the annotated method name).
     */
    public final String name;

    /**
     * Category of the trace.
     */
    public final ActionOn category;

    /**
     * Final status of the trace: {@code "OK"} or {@code "ERROR"}.
     */
    public final String status;

    /**
     * Absolute start time of the trace.
     */
    public final Instant startTime;

    /**
     * Human-readable start-time label.
     */
    public final String startLabel;

    /**
     * Total duration of the trace in milliseconds.
     */
    public final double durationMs;

    /**
     * Total number of spans in this trace (including the root).
     */
    public final int spanCount;

    /**
     * Number of spans whose status is "ERROR".
     */
    public final int errorCount;

    /**
     * Number of spans that were dropped because maxSpans limit was reached.
     */
    public final int dropped;

    /**
     * Captured input argument details for the root invocation.
     */
    public final List<ArgumentDetail> inputArgs;

    /**
     * Captured output argument / return value details for the root invocation.
     */
    public final ReturnDetail outputArgs;

    /**
     * List of all {@link Span}s captured in this trace.
     */
    public final List<Span> spans;

    /**
     * Constructs a {@link TraceRecord} from the given {@link TraceContext}.
     *
     * @param ctx the trace context; must contain at least one span (the root)
     */
    public TraceRecord(TraceContext ctx) {
        this.spans = ctx != null ? List.copyOf(ctx.spans) : List.of();
        Span root = !spans.isEmpty() ? spans.getFirst() : null;
        this.traceId = ctx != null ? ctx.traceId : "";
        this.name = root != null ? root.name : "unknown";
        this.category = root != null ? root.category : ActionOn.AUTO;
        this.status = root != null ? root.status : "OK";
        this.startTime = ctx != null ? ctx.startTime : Instant.now();
        this.startLabel = LABEL.format(this.startTime);
        this.durationMs = root != null ? root.durationMs : 0.0;
        this.spanCount = spans.size();
        this.dropped = ctx != null ? ctx.dropped : 0;
        this.inputArgs = (root != null && root.inputArgs != null) ? List.copyOf(root.inputArgs) : null;
        this.outputArgs = (root != null) ? root.outputArgs : null;

        int errors = 0;
        for (Span s : spans) {
            s.offsetMs = (s.startNanos - ctx.startNanos) / 1_000_000.0;
            if (durationMs > 0) {
                s.offsetPct = Math.min(99.5, s.offsetMs * 100.0 / durationMs);
                s.widthPct = Math.clamp(s.durationMs * 100.0 / durationMs, 0.5, 100.0 - s.offsetPct);
            } else {
                s.offsetPct = 0;
                s.widthPct = 100;
            }
            if (s.isFailed()) errors++;
        }
        this.errorCount = errors;
    }

    public String getTraceId() {
        return traceId;
    }

    public String getName() {
        return name;
    }

    public ActionOn getCategory() {
        return category;
    }

    public String getStatus() {
        return status;
    }

    public Instant getStartTime() {
        return startTime;
    }

    public String getStartLabel() {
        return startLabel;
    }

    public double getDurationMs() {
        return durationMs;
    }

    public int getSpanCount() {
        return spanCount;
    }

    public int getErrorCount() {
        return errorCount;
    }

    public int getDropped() {
        return dropped;
    }

    public List<ArgumentDetail> getInputArgs() {
        return inputArgs != null ? inputArgs : List.of();
    }

    public ReturnDetail getOutputArgs() {
        return outputArgs;
    }

    public List<Span> getSpans() {
        return spans;
    }

    public Map<String, Object> toMap() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("traceId", traceId);
        m.put("name", name);
        m.put("category", category);
        m.put("status", status);
        m.put("startTime", startTime != null ? startTime.toString() : null);
        m.put("startLabel", startLabel);
        m.put("durationMs", durationMs);
        m.put("spanCount", spanCount);
        m.put("errorCount", errorCount);
        m.put("dropped", dropped);
        if (inputArgs != null) {
            m.put("inputArgs", inputArgs.stream().map(ArgumentDetail::toMap).toList());
        }
        if (outputArgs != null) {
            m.put("outputArgs", outputArgs.toMap());
        }
        m.put("spans", spans.stream().map(Span::toMap).toList());
        return m;
    }

    @Override
    public String toString() {
        return String.format("TraceRecord[traceId=%s, name=%s, durationMs=%.2f, spanCount=%d]",
                traceId, name, durationMs, spanCount);
    }
}