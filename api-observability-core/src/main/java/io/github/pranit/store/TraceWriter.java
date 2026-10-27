package io.github.pranit.store;

import io.github.pranit.model.TraceRecord;

/**
 * Write side: used by the collector / interceptor.
 */
public interface TraceWriter {
    
    void add(TraceRecord record);

    /**
     * Deletes one trace. Returns true if it existed.
     */
    boolean delete(String traceId);

    /**
     * Deletes all traces.
     */
    void clear();
}