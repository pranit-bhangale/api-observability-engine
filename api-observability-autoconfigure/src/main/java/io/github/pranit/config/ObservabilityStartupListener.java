package io.github.pranit.config;

import io.github.pranit.properties.ServiceProperties;
import org.jspecify.annotations.NonNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;

/**
 * Startup event listener that logs a single minimal notice when the Observability UI endpoint is enabled.
 */
public class ObservabilityStartupListener implements ApplicationListener<ApplicationReadyEvent> {

    private static final Logger log = LoggerFactory.getLogger("io.github.pranit.Observability");

    private final ServiceProperties.ObserveSettings properties;

    public ObservabilityStartupListener(ServiceProperties.ObserveSettings properties) {
        this.properties = properties;
    }

    @Override
    public void onApplicationEvent(@NonNull ApplicationReadyEvent event) {
        if (properties.observe() == null || !properties.observe().enabled()) return;
        String endpoint = properties.getPath();
        if (!endpoint.startsWith("/")) endpoint = "/" + endpoint;
        log.info("Observability endpoint enabled: {}", endpoint);
    }
}
