package io.github.pranit.store;

import io.github.pranit.model.TraceRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentLinkedDeque;

public class ClickHouseObserveStore implements ObserveStore {

    private final static Logger LOGGER = LoggerFactory.getLogger(ClickHouseObserveStore.class);

    // Singleton instance
    private static volatile ClickHouseObserveStore instance;
    // JDBC configuration
    private final String jdbcUrl;
    private final String username;
    private final String password;
    private final int maxTraces;
    // In-memory buffer for fast UI representation
    private final ConcurrentLinkedDeque<TraceRecord> buffer;
    // Lazy-initialized connection
    private volatile Connection connection;

    private ClickHouseObserveStore(String jdbcUrl, String username, String password, int maxTraces) {
        this.jdbcUrl = jdbcUrl;
        this.username = username;
        this.password = password;
        this.maxTraces = Math.max(1, maxTraces);
        this.buffer = new ConcurrentLinkedDeque<>();
    }

    /**
     * Gets the Singleton instance, creating it if needed.
     *
     * @param jdbcUrl   ClickHouse JDBC URL
     * @param username  ClickHouse username
     * @param password  ClickHouse password
     * @param maxTraces Maximum traces to keep in memory
     * @return The Singleton instance
     */
    public static ClickHouseObserveStore getInstance(String jdbcUrl, String username, String password, int maxTraces) {
        if (instance == null) {
            synchronized (ClickHouseObserveStore.class) {
                if (instance == null) {
                    instance = new ClickHouseObserveStore(jdbcUrl, username, password, maxTraces);
                }
            }
        }
        return instance;
    }

    /**
     * Gets the Singleton instance (must be initialized first).
     *
     * @return The Singleton instance
     * @throws IllegalStateException if not initialized
     */
    public static ClickHouseObserveStore getInstance() {
        if (instance == null) {
            throw new IllegalStateException("ClickHouseObserveStore not initialized.");
        }
        return instance;
    }

    /**
     * Lazy initialization of the ClickHouse connection.
     * Creates the connection on first database operation.
     */
    private synchronized Connection getConnection() throws SQLException {
        if (connection == null || connection.isClosed()) {
            connection = DriverManager.getConnection(jdbcUrl, username, password);
            ensureTableExists();
        }
        return connection;
    }

    /**
     * Ensures the 'traces' table exists in ClickHouse.
     * Creates it if not exists using ENGINE=Memory for fast operations.
     */
    private void ensureTableExists() {
        try (Statement stmt = getConnection().createStatement()) {

        } catch (SQLException e) {
            LOGGER.error("Failed to ensure Clickhouse table exists: {}", e.getMessage());
        }
    }

    @Override
    public void add(TraceRecord record) {

    }

    @Override
    public List<TraceRecord> getTraces() {
        return List.of();
    }

    @Override
    public List<TraceRecord> getRecent(int limit) {
        return List.of();
    }

    @Override
    public Optional<TraceRecord> getTrace(String traceId) {
        return Optional.empty();
    }

    @Override
    public void clear() {

    }

    @Override
    public int size() {
        return 0;
    }
}
