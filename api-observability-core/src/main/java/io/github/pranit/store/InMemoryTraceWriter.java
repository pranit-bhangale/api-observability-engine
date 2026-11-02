package io.github.pranit.store;

import io.github.pranit.model.TraceRecord;

final class InMemoryTraceWriter implements TraceWriter {

    private final TraceBuffer buffer;

    InMemoryTraceWriter(TraceBuffer buffer) {
        this.buffer = buffer;
    }

    @Override
    public void add(TraceRecord record) {
        if (record == null) return;
        buffer.put(record);
    }

    @Override
    public boolean delete(String traceId) {
        return buffer.remove(traceId);
    }

    @Override
    public void clear() {
        buffer.clear();
    }
}