package io.github.pranit.config;

import io.github.pranit.properties.ServiceProperties;
import org.jspecify.annotations.NonNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;

/**
 * Startup event listener that logs runtime status and informs whether UI is active or in Headless Mode.
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
        boolean hasUi = event.getApplicationContext().getResource("classpath:/static/obs/index.html").exists()
                || event.getApplicationContext().getResource("classpath:/META-INF/resources/obs/index.html").exists();
        if (hasUi) {
            log.info("API Observability: Live Engine active at {} (Dashboard UI enabled)", endpoint);
        } else {
            log.info("API Observability: Headless Telemetry Engine active at {} (UI module excluded)", endpoint);
        }
    }
}
