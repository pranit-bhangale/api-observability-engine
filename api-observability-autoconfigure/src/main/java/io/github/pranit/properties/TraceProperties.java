package io.github.pranit.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import java.util.List;

/**
 * All tracing configuration is grouped under the {@code service.tracing} prefix.
 */
@ConfigurationProperties(prefix = "service.tracing")
public record TraceProperties(

        @DefaultValue TraceSettings trace
) {

    public record TraceSettings(
            @DefaultValue("true") boolean enabled,
            @DefaultValue("") String directory,
            @DefaultValue("trace") String filePrefix,
            @DefaultValue("14") int retentionDays,
            @DefaultValue("true") boolean async,
            List<String> maskKeys,
            @DefaultValue("false") boolean clickHouseEnabled,
            @DefaultValue("localhost") String clickHouseHost,
            @DefaultValue("8123") int clickHousePort,
            @DefaultValue("default") String clickHouseDatabase,
            @DefaultValue("default") String clickHouseUser,
            @DefaultValue("") String clickHousePassword,
            @DefaultValue("10000") int clickHouseMaxTraces
    ) {
        public List<String> maskKeys() {
            return maskKeys != null ? maskKeys : List.of();
        }
    }
}
