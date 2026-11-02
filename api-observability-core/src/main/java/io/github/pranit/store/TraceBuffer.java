package io.github.pranit.store;

import io.github.pranit.model.TraceRecord;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantReadWriteLock;

/**
 * Bounded, insertion-ordered trace storage keyed by traceId.
 * Many readers can run concurrently; writers are exclusive.
 */
final class TraceBuffer {

    private final int maxTraces;
    private final LinkedHashMap<String, TraceRecord> map = new LinkedHashMap<>();

    private final ReentrantReadWriteLock rw = new ReentrantReadWriteLock();
    private final Lock readLock = rw.readLock();
    private final Lock writeLock = rw.writeLock();

    TraceBuffer(int maxTraces) {
        this.maxTraces = Math.max(1, maxTraces);
    }

    // ---------- write operations ----------

    /**
     * Case-insensitive key, same behaviour as the original equalsIgnoreCase.
     */
    private static String key(String traceId) {
        return (traceId == null || traceId.isBlank())
                ? null
                : traceId.toLowerCase(Locale.ROOT);
    }

    void put(TraceRecord record) {
        String key = key(record.getTraceId());
        if (key == null) return;

        writeLock.lock();
        try {
            map.remove(key);          // re-adding the same id moves it to "newest"
            map.put(key, record);
            while (map.size() > maxTraces) {
                var it = map.entrySet().iterator();   // eldest = first entry
                it.next();
                it.remove();
            }
        } finally {
            writeLock.unlock();
        }
    }

    boolean remove(String traceId) {
        String key = key(traceId);
        if (key == null) return false;

        writeLock.lock();
        try {
            return map.remove(key) != null;
        } finally {
            writeLock.unlock();
        }
    }

    // ---------- read operations ----------

    void clear() {
        writeLock.lock();
        try {
            map.clear();
        } finally {
            writeLock.unlock();
        }
    }

    /**
     * Newest-first immutable snapshot of at most {@code limit} traces.
     */
    List<TraceRecord> newest(int limit) {
        if (limit <= 0) return List.of();

        readLock.lock();
        try {
            return map.reversed().values().stream()
                    .limit(limit)
                    .toList();
        } finally {
            readLock.unlock();
        }
    }

    Optional<TraceRecord> find(String traceId) {
        String key = key(traceId);
        if (key == null) return Optional.empty();

        readLock.lock();
        try {
            return Optional.ofNullable(map.get(key));
        } finally {
            readLock.unlock();
        }
    }

    int size() {
        readLock.lock();
        try {
            return map.size();
        } finally {
            readLock.unlock();
        }
    }
}