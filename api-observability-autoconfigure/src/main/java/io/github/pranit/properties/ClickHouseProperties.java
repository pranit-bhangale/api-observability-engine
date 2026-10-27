package io.github.pranit.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * ClickHouse storage settings. Lives under the existing observe block:
 * service.observing.observe.clickhouse.*
 */
@ConfigurationProperties(prefix = "clickhouse")
public record ClickHouseProperties(
        @DefaultValue("false") boolean enabled,
        @DefaultValue("") String url,
        @DefaultValue("default") String user,
        @DefaultValue("") String password,
        @DefaultValue("traces") String table,
        @DefaultValue("4") int poolSize,
        @DefaultValue("500") int batchSize,
        @DefaultValue("1000") long flushIntervalMs,
        @DefaultValue("10000") int queueCapacity,
        @DefaultValue("0") int ttlDays
) {
}