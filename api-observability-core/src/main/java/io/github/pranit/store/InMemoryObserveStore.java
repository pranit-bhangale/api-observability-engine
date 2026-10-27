package io.github.pranit.store;

import io.github.pranit.model.TraceRecord;

import java.util.List;
import java.util.Optional;

/**
 * Singleton in-memory store.
 * Optionally call init(maxTraces) once at startup; otherwise getInstance() uses 500.
 */
public final class InMemoryObserveStore implements ObserveStore {

    private static final int DEFAULT_MAX_TRACES = 500;
    private static volatile InMemoryObserveStore instance;

    private final TraceWriter writer;
    private final TraceReader reader;

    private InMemoryObserveStore(int maxTraces) {
        TraceBuffer buffer = new TraceBuffer(maxTraces);
        this.writer = new InMemoryTraceWriter(buffer);
        this.reader = new InMemoryTraceReader(buffer);
    }

    public static InMemoryObserveStore init(int maxTraces) {
        if (instance == null) {
            synchronized (InMemoryObserveStore.class) {
                if (instance == null) {
                    instance = new InMemoryObserveStore(maxTraces);
                }
            }
        }
        return instance;
    }

    public static InMemoryObserveStore getInstance() {
        InMemoryObserveStore s = instance;
        return s != null ? s : init(DEFAULT_MAX_TRACES);
    }

    public TraceWriter writer() {
        return writer;
    }

    public TraceReader reader() {
        return reader;
    }

    @Override
    public void add(TraceRecord record) {
        writer.add(record);
    }

    @Override
    public boolean delete(String traceId) {
        return writer.delete(traceId);
    }

    @Override
    public void clear() {
        writer.clear();
    }

    @Override
    public List<TraceRecord> getTraces() {
        return reader.getTraces();
    }

    @Override
    public List<TraceRecord> getRecent(int limit) {
        return reader.getRecent(limit);
    }

    @Override
    public Optional<TraceRecord> getTrace(String id) {
        return reader.getTrace(id);
    }

    @Override
    public int size() {
        return reader.size();
    }
}