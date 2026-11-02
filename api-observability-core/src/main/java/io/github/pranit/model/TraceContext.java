package io.github.pranit.model;

import io.github.pranit.annotation.ActionOn;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Per-thread state of the trace that is currently being recorded.
 * <p>
 * Created by the outermost annotated call and removed when it returns.
 * <p>
 * Thread Safety: This class uses a {@link ThreadLocal} so each thread has its
 * own independent trace context. All tracing metadata for the current thread (trace ID,
 * start time, captured spans, etc.) is stored here. This class is thread-safe in that
 * each thread operates on its own context instance.
 * </p>
 *
 * @see Span       Individual span captured within this context
 * @see TraceRecord Aggregated record written at trace end
 */
public final class TraceContext {

    /**
     * ThreadLocal holding the current trace context, or {@code null} if no trace is active.
     */
    private static final ThreadLocal<TraceContext> CURRENT = new ThreadLocal<>();

    /**
     * Unique identifier for the trace.
     */
    public final String traceId = UUID.randomUUID().toString().replace("-", "");

    /**
     * Absolute start time of the trace.
     */
    public final Instant startTime = Instant.now();

    /**
     * Nano-timestamp at trace start, used for high-resolution offset calculation.
     */
    public final long startNanos = System.nanoTime();

    /**
     * Whether per-span JSON logging is enabled.
     */
    public final boolean trace;

    /**
     * Whether live dashboard observation is enabled.
     */
    public final boolean observe;

    /**
     * Whether this is a deep (controller-style) trace capturing nested calls.
     */
    public final boolean deep;

    /**
     * Whether method arguments are captured (and masked).
     */
    public final boolean captureArgs;

    /**
     * Whether method return values are captured (and masked).
     */
    public final boolean captureReturn;

    /**
     * Maximum characters kept per argument/return value.
     */
    public final int maxLen;

    /**
     * Maximum number of spans allowed in a single trace.
     */
    public final int maxSpans;

    /**
     * List of spans captured in this trace.
     */
    public final List<Span> spans = new ArrayList<>();

    /**
     * Stack of spans for parent-child relationship tracking.
     */
    private final Deque<Span> stack = new ArrayDeque<>();

    /**
     * Count of dropped spans due to maxSpans limit.
     */
    public int dropped;

    /**
     * Constructs a new TraceContext.
     *
     * @param trace         whether per-span JSON logging is enabled
     * @param observe       whether live dashboard observation is enabled
     * @param deep          whether this is a deep (controller-style) trace
     * @param captureArgs   whether method arguments are captured
     * @param captureReturn whether method return values are captured
     * @param maxLen        maximum characters kept per argument/return value
     * @param maxSpans      maximum number of spans allowed in a single trace
     */
    public TraceContext(
            boolean trace, boolean observe,
            boolean deep, boolean captureArgs,
            boolean captureReturn, int maxLen, int maxSpans) {
        this.trace = trace;
        this.observe = observe;
        this.deep = deep;
        this.captureArgs = captureArgs;
        this.captureReturn = captureReturn;
        this.maxLen = maxLen;
        this.maxSpans = maxSpans;
    }

    /**
     * Returns the current trace context for the calling thread.
     *
     * @return the current TraceContext, or {@code null} if no trace is active
     */
    public static TraceContext current() {
        return CURRENT.get();
    }

    /**
     * Binds the given trace context to the current thread.
     *
     * @param ctx the trace context to bind
     */
    public static void bind(TraceContext ctx) {
        CURRENT.set(ctx);
    }

    /**
     * Unbinds the current trace context from the thread.
     */
    public static void unbind() {
        CURRENT.remove();
    }

    /**
     * Generates a new span ID.
     *
     * @return a new span ID as a hex string
     */
    public static String newSpanId() {
        return String.format("%016x", ThreadLocalRandom.current().nextLong());
    }

    /**
     * Creates a new span and adds it to this trace context.
     *
     * @param category  the category of the call
     * @param name      the span name
     * @param className the fully qualified class name
     * @param method    the method name
     * @return the newly created span
     */
    public Span span(ActionOn category, String name, String className, String method) {
        Span parent = stack.peek();
        Span s = new Span(traceId, newSpanId(), parent == null ? null : parent.spanId,
                stack.size(), category, name, className, method);
        spans.add(s);
        stack.push(s);
        return s;
    }

    /**
     * Returns the current span (the one on top of the stack).
     *
     * @return the current span, or {@code null} if no spans
     */
    public Span currentSpan() {
        return stack.isEmpty() ? null : stack.peek();
    }

    /**
     * Returns whether the trace is full (has reached maxSpans).
     *
     * @return true if max spans reached
     */
    public boolean full() {
        return spans.size() >= maxSpans;
    }

    /**
     * Increments the dropped span counter.
     */
    public void markDropped() {
        dropped++;
    }

    /**
     * Closes the given span, calculating its duration.
     *
     * @param s the span to close
     */
    public void close(Span s) {
        s.durationMs = (System.nanoTime() - s.startNanos) / 1_000_000.0;
        if (!stack.isEmpty()) stack.pop();
    }
}