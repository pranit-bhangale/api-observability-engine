package io.github.pranit.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Properties for the API observability engine observe configuration.
 */
@ConfigurationProperties(prefix = "service.observing")
public record ObserveProperties(
        @DefaultValue ObserveSettings observe
) {
    public String getPath() {
        return (observe != null && observe.endpoint() != null && !observe.endpoint().isBlank())
                ? observe.endpoint() : "/obs";
    }

    public record ObserveSettings(
            @DefaultValue("false") boolean enabled,
            @DefaultValue("/obs") String endpoint,
            @DefaultValue("API Observability") String title,
            @DefaultValue("") String username,
            @DefaultValue("") String password,
            @DefaultValue("500") int maxTraces
    ) {
    }
}
