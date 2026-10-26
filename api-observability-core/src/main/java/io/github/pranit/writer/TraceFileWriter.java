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
 * Daily rotating JSON line log file writer for traces with automatic retention cleanup.
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
        try {
            Path dir = Paths.get(directory);
            if (!Files.exists(dir)) Files.createDirectories(dir);
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
                raf.seek(0);
                int firstChar = -1;
                while (raf.getFilePointer() < length) {
                    int b = raf.read();
                    if (!Character.isWhitespace(b)) {
                        firstChar = b;
                        break;
                    }
                }
                if (firstChar != '[') {
                    raf.close();
                    migrateLegacyFile(jsonFilePath, jsonRecord);
                    return;
                }
                long pos = length - 1;
                while (pos >= 0) {
                    raf.seek(pos);
                    int b = raf.read();
                    if (b == ']') {
                        break;
                    }
                    pos--;
                }
                if (pos >= 0) {
                    raf.seek(pos);
                    String appendData = ",\n  " + jsonRecord + "\n]\n";
                    raf.write(appendData.getBytes(StandardCharsets.UTF_8));
                } else {
                    raf.seek(length);
                    String appendData = "\n  ," + jsonRecord + "\n]\n";
                    raf.write(appendData.getBytes(StandardCharsets.UTF_8));
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
