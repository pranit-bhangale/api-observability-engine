package io.github.pranit.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.util.List;

@ConfigurationProperties(prefix = "service")
public record ServiceProperties(

        @DefaultValue ObserveSettings observing,
        @DefaultValue ObserveSecuritySettings observe,
        @DefaultValue TraceSettings tracing,
        @DefaultValue ClickHouseSettings clickhouse

) {

    public record ObserveSettings(
            @DefaultValue ObserveConfig observe
    ) {
        public String getPath() {
            return observe != null
                    && observe.endpoint() != null
                    && !observe.endpoint().isBlank()
                    ? observe.endpoint() : "/obs";
        }
    }

    public record ObserveConfig(
            @DefaultValue("false") boolean enabled,
            @DefaultValue("/obs") String endpoint,
            @DefaultValue("API Observability") String title,
            @DefaultValue("500") int maxTraces
    ) {
    }

    public record ObserveSecuritySettings(
            @DefaultValue("OBSERVABILITY_ADMIN") String role,
            @DefaultValue("") String username,
            @DefaultValue("") String password
    ) {
        public String normalizedRole() {
            String r = (role == null || role.isBlank())
                    ? "OBSERVABILITY_ADMIN" : role.trim();
            return r.startsWith("ROLE_") ? r.substring(5) : r;
        }
    }

    public record TraceSettings(
            @DefaultValue("true") boolean enabled,
            @DefaultValue("") String directory,
            @DefaultValue("trace") String filePrefix,
            @DefaultValue("14") int retentionDays,
            @DefaultValue("true") boolean async,
            List<String> maskKeys
    ) {
        public List<String> maskKeys() {
            return maskKeys != null ? maskKeys : List.of();
        }
    }

    public record ClickHouseSettings(
            @DefaultValue("false") boolean enabled,
            @DefaultValue("") String url,
            @DefaultValue("localhost") String host,
            @DefaultValue("8123") int port,
            @DefaultValue("default") String database,
            @DefaultValue("default") String user,
            @DefaultValue("") String password,
            @DefaultValue("traces") String table,
            @DefaultValue("4") int poolSize,
            @DefaultValue("500") int batchSize,
            @DefaultValue("1000") long flushIntervalMs,
            @DefaultValue("10000") int queueCapacity,
            @DefaultValue("0") int ttlDays,
            @DefaultValue("10000") int maxTraces
    ) {
    }
}
