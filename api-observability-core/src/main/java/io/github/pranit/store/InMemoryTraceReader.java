package io.github.pranit.store;

import io.github.pranit.model.TraceRecord;

import java.util.List;
import java.util.Optional;

final class InMemoryTraceReader implements TraceReader {

    private final TraceBuffer buffer;

    InMemoryTraceReader(TraceBuffer buffer) {
        this.buffer = buffer;
    }

    @Override
    public List<TraceRecord> getTraces() {
        return buffer.newest(Integer.MAX_VALUE);
    }

    @Override
    public List<TraceRecord> getRecent(int limit) {
        return buffer.newest(limit);
    }

    @Override
    public Optional<TraceRecord> getTrace(String traceId) {
        return buffer.find(traceId);
    }

    @Override
    public int size() {
        return buffer.size();
    }
}