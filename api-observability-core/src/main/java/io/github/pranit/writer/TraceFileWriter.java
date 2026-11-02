package io.github.pranit.writer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import io.github.pranit.model.TraceRecord;

import java.io.File;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Stream;

/**
 * High-performance daily rotating JSON log file writer for traces with automatic retention cleanup.
 */
public class TraceFileWriter implements AutoCloseable {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private final String directory;
    private final String filePrefix;
    private final boolean async;
    private final int retentionDays;
    private final ObjectMapper mapper;
    private final ExecutorService executor;
    private final AtomicReference<LocalDate> lastCleanupDate;
    private volatile boolean directoryEnsured;

    public TraceFileWriter(String directory, String filePrefix, boolean async, int retentionDays) {
        this.directory = directory != null ? directory : "logs/trace";
        this.filePrefix = filePrefix != null ? filePrefix : "trace";
        this.async = async;
        this.retentionDays = retentionDays;
        this.lastCleanupDate = new AtomicReference<>(LocalDate.now());
        this.mapper = new ObjectMapper();
        this.mapper.registerModule(new JavaTimeModule());
        this.mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        this.executor = async
                ? Executors.newThreadPerTaskExecutor(Thread.ofVirtual()
                .name("trace-writer-", 1).factory()) : null;
        ensureDirectory();
        triggerRetentionCleanup();
    }

    private void ensureDirectory() {
        if (directoryEnsured) return;
        try {
            Path dir = Paths.get(directory);
            if (!Files.exists(dir)) Files.createDirectories(dir);
            directoryEnsured = true;
        } catch (IOException ignored) {
        }
    }

    /**
     * Triggers asynchronous log file retention cleanup on a virtual thread.
     */
    public void triggerRetentionCleanup() {
        if (retentionDays <= 0) return;
        if (async && executor != null && !executor.isShutdown())
            executor.submit(this::cleanOldLogs);
        else
            Thread.ofVirtual().name("trace-retention-").start(this::cleanOldLogs);
    }

    /**
     * Scans the log directory and deletes trace log files older than retentionDays.
     * If retentionDays is 0 or negative, files are retained indefinitely.
     */
    public void cleanOldLogs() {
        if (retentionDays <= 0) return;
        try {
            Path dir = Paths.get(directory);
            if (!Files.exists(dir) || !Files.isDirectory(dir)) return;
            LocalDate cutoffDate = LocalDate.now().minusDays(retentionDays);
            String prefix = filePrefix + "-";
            try (Stream<Path> stream = Files.list(dir)) {
                stream.filter(Files::isRegularFile)
                        .filter(path -> {
                            String fileName = path.getFileName().toString();
                            return fileName.startsWith(prefix) && fileName.endsWith(".json");
                        })
                        .forEach(path -> {
                            String fileName = path.getFileName().toString();
                            int extLen = ".json".length();
                            int startIdx = prefix.length();
                            int endIdx = fileName.length() - extLen;
                            if (endIdx > startIdx) {
                                String datePart = fileName.substring(startIdx, endIdx);
                                try {
                                    LocalDate fileDate = LocalDate.parse(datePart, DATE_FMT);
                                    if (fileDate.isBefore(cutoffDate)) {
                                        Files.deleteIfExists(path);
                                    }
                                } catch (Exception e) {
                                    try {
                                        var lastModified = Files.getLastModifiedTime(path).toInstant();
                                        var cutoffInstant = cutoffDate.atStartOfDay(ZoneId.systemDefault()).toInstant();
                                        if (lastModified.isBefore(cutoffInstant)) Files.deleteIfExists(path);
                                    } catch (IOException ignored) {
                                    }
                                }
                            }
                        });
            }
        } catch (Exception ignored) {
        }
    }

    /**
     * Writes a trace record to today's json file as a valid JSON array element.
     */
    public void write(TraceRecord record) {
        if (record == null) return;
        if (async && executor != null && !executor.isShutdown())
            executor.submit(() -> writeRecord(record));
        else
            writeRecord(record);
    }

    private void writeRecord(TraceRecord record) {
        try {
            String jsonRecord = mapper.writeValueAsString(record.toMap());
            appendRecord(jsonRecord);
        } catch (Exception ignored) {
        }
    }

    private synchronized void appendRecord(String jsonRecord) {
        try {
            ensureDirectory();
            LocalDate today = LocalDate.now();
            LocalDate lastClean = lastCleanupDate.get();
            if (!today.equals(lastClean)) {
                if (lastCleanupDate.compareAndSet(lastClean, today))
                    triggerRetentionCleanup();
            }
            String date = today.format(DATE_FMT);
            Path jsonFilePath = Paths.get(directory, filePrefix + "-" + date + ".json");
            File file = jsonFilePath.toFile();
            if (!file.exists() || file.length() == 0) {
                String content = "[\n  " + jsonRecord + "\n]\n";
                Files.writeString(jsonFilePath, content, StandardCharsets.UTF_8,
                        StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
                return;
            }

            try (RandomAccessFile raf = new RandomAccessFile(file, "rw")) {
                long length = raf.length();
                // Fast-check start of file for JSON array opener
                if (length < 2) {
                    Files.writeString(jsonFilePath, "[\n  " + jsonRecord + "\n]\n", StandardCharsets.UTF_8);
                    return;
                }

                // Read tail buffer (up to 128 bytes) in a single read to find ']'
                int tailSize = (int) Math.min(length, 128L);
                long tailStart = length - tailSize;
                raf.seek(tailStart);
                byte[] tailBuf = new byte[tailSize];
                raf.readFully(tailBuf);

                int bracketOffset = -1;
                for (int i = tailSize - 1; i >= 0; i--) {
                    if (tailBuf[i] == ']') {
                        bracketOffset = i;
                        break;
                    }
                }

                if (bracketOffset >= 0) {
                    raf.seek(tailStart + bracketOffset);
                    String appendData = ",\n  " + jsonRecord + "\n]\n";
                    raf.write(appendData.getBytes(StandardCharsets.UTF_8));
                } else {
                    // Fallback to legacy migration if file doesn't end with JSON array bracket
                    raf.close();
                    migrateLegacyFile(jsonFilePath, jsonRecord);
                }
            }
        } catch (Exception ignored) {
        }
    }

    private void migrateLegacyFile(Path path, String newRecord) {
        try {
            File file = path.toFile();
            List<String> objects = new ArrayList<>();
            try (var it = mapper.readerFor(Object.class).readValues(file)) {
                while (it.hasNext()) {
                    objects.add(mapper.writeValueAsString(it.next()));
                }
            }
            objects.add(newRecord);
            StringBuilder sb = new StringBuilder("[\n");
            for (int i = 0; i < objects.size(); i++) {
                if (i > 0) sb.append(",\n");
                sb.append("  ").append(objects.get(i));
            }
            sb.append("\n]\n");
            Files.writeString(path, sb.toString(), StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
        } catch (Exception e) {
            try {
                Files.writeString(path, "[\n  " + newRecord + "\n]\n", StandardCharsets.UTF_8,
                        StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
            } catch (Exception ignored) {
            }
        }
    }

    public int getRetentionDays() {
        return retentionDays;
    }

    @Override
    public void close() {
        if (executor != null) {
            executor.shutdown();
            try {
                if (!executor.awaitTermination(2, TimeUnit.SECONDS)) {
                    executor.shutdownNow();
                }
            } catch (InterruptedException e) {
                executor.shutdownNow();
                Thread.currentThread().interrupt();
            }
        }
    }
}
