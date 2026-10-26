package io.github.pranit.store;

import io.github.pranit.model.TraceRecord;

import java.util.List;
import java.util.Optional;

/**
 * Defines storage operations for adding, retrieving, and managing trace records.
 */
public interface ObserveStore {

    /**
     * Adds a trace record to the store.
     */
    void add(TraceRecord record);

    /**
     * Returns all stored trace records.
     */
    List<TraceRecord> getTraces();

    /**
     * Returns the most recent trace records up to the specified limit.
     */
    List<TraceRecord> getRecent(int limit);

    /**
     * Returns the trace record matching the specified trace ID, if present.
     */
    Optional<TraceRecord> getTrace(String traceId);

    /**
     * Removes all trace records from the store.
     */
    void clear();

    /**
     * Returns the number of stored trace records.
     */
    int size();
}
