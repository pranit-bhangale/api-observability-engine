package io.github.pranit.store;

import io.github.pranit.model.TraceRecord;

import java.util.List;
import java.util.Optional;

/**
 * Read side: used by the dashboard UI and REST API.
 */
public interface TraceReader {
    
    List<TraceRecord> getTraces();

    List<TraceRecord> getRecent(int limit);

    Optional<TraceRecord> getTrace(String traceId);

    int size();
}