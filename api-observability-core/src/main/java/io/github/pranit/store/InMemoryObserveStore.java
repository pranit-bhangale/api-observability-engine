package io.github.pranit.store;

import io.github.pranit.model.TraceRecord;

import java.util.Deque;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Thread-safe in-memory store for recent traces, consumed by the dashboard UI and REST API.
 */
public class InMemoryObserveStore implements ObserveStore {

    private final int maxTraces;
    private final Deque<TraceRecord> buffer = new ConcurrentLinkedDeque<>();
    private final AtomicInteger size = new AtomicInteger(0);

    public InMemoryObserveStore() {
        this(500);
    }

    public InMemoryObserveStore(int maxTraces) {
        this.maxTraces = Math.max(1, maxTraces);
    }

    /**
     * Appends a new trace record to the in-memory store.
     */
    @Override
    public void add(TraceRecord record) {
        if (record == null) return;
        buffer.addFirst(record);
        if (size.incrementAndGet() > maxTraces) {
            if (buffer.pollLast() != null) size.decrementAndGet();
        }
    }

    /**
     * Returns an unmodifiable list of all buffered traces, newest first.
     */
    @Override
    public List<TraceRecord> getTraces() {
        return List.copyOf(buffer);
    }

    /**
     * Returns the most recent N traces.
     */
    @Override
    public List<TraceRecord> getRecent(int limit) {
        return buffer.stream()
                .limit(Math.max(0, limit))
                .toList();
    }

    /**
     * Finds a trace record by its unique traceId.
     */
    @Override
    public Optional<TraceRecord> getTrace(String traceId) {
        if (traceId == null || traceId.isBlank()) return Optional.empty();
        return buffer.stream()
                .filter(t -> traceId.equalsIgnoreCase(t.getTraceId()))
                .findFirst();
    }

    /**
     * Clears all traces currently in memory.
     */
    @Override
    public void clear() {
        buffer.clear();
        size.set(0);
    }

    /**
     * Current count of stored traces.
     */
    @Override
    public int size() {
        return Math.max(0, size.get());
    }
}
