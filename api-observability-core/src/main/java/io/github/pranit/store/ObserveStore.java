package io.github.pranit.store;

import io.github.pranit.model.TraceRecord;

import java.util.List;
import java.util.Optional;

public interface ObserveStore {

    /**
     * Appends a new trace record to the in-memory store.
     */
    void add(TraceRecord record);

    /**
     * Returns an unmodifiable list of all buffered traces, newest first.
     */
    List<TraceRecord> getTraces();

    /**
     * Returns the most recent N traces.
     */
    List<TraceRecord> getRecent(int limit);

    /**
     * Finds a trace record by its unique traceId.
     */
    Optional<TraceRecord> getTrace(String traceId);

    /**
     * Clears all traces currently in memory.
     */
    void clear();

    /**
     * Current count of stored traces.
     */
    int size();

}
