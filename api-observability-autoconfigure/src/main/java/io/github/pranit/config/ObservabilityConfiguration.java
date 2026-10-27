package io.github.pranit.config;

import io.github.pranit.aspect.TracingAspect;
import io.github.pranit.properties.ClickHouseProperties;
import io.github.pranit.properties.ObserveProperties;
import io.github.pranit.properties.TraceProperties;
import io.github.pranit.store.InMemoryObserveStore;
import io.github.pranit.store.ObserveStore;
import io.github.pranit.writer.TraceFileWriter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;

import java.util.List;

@AutoConfiguration(beforeName = {
        "org.springframework.boot.security.autoconfigure.SecurityAutoConfiguration",
        "org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration",
        "org.springframework.boot.security.autoconfigure.web.servlet.ServletWebSecurityAutoConfiguration",
        "org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration",
        "org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration"
})
@EnableConfigurationProperties({
        TraceProperties.class,
        ObserveProperties.class,
        ClickHouseProperties.class
})
public class ObservabilityConfiguration {

    private static final Logger log = LoggerFactory.getLogger(ObservabilityConfiguration.class);

    @Bean
    @ConditionalOnMissingBean(ObserveStore.class)
    @ConditionalOnProperty(
            prefix = "clickhouse",
            name = "enabled",
            havingValue = "false",
            matchIfMissing = true
    )
    public ObserveStore observeStore(ObserveProperties properties) {
        int maxTraces = (properties.observe() != null) ? properties.observe().maxTraces() : 500;
        log.info("API Observability: using in-memory trace store (maxTraces: {})", maxTraces);
        return InMemoryObserveStore.init(maxTraces);
    }

    /**
     * Used only when service.observing.observe.clickhouse.enabled=true.
     */
//    @Bean(destroyMethod = "close")
//    @ConditionalOnMissingBean(ObserveStore.class)
//    @ConditionalOnProperty(
//            prefix = "service.observing.observe.clickhouse",
//            name = "enabled",
//            havingValue = "true"
//    )
//    public ClickHouseObserveStore clickHouseObserveStore(ClickHouseProperties p) {
//        if (p.url() == null || p.url().isBlank()) {
//            throw new IllegalStateException("clickhouse url is not set");
//        }
//        log.info("API Observability: using CLICKHOUSE trace store (table={})", p.table());
//        return ClickHouseObserveStore.init(new ClickHouseConfig(
//                p.url(), p.user(), p.password(), p.table(),
//                p.poolSize(), p.batchSize(), p.flushIntervalMs(),
//                p.queueCapacity(), p.ttlDays()));
//    }
    @Bean(destroyMethod = "close")
    @ConditionalOnMissingBean
    @ConditionalOnProperty(
            prefix = "service.tracing.trace",
            name = "enabled",
            havingValue = "true",
            matchIfMissing = true
    )
    public TraceFileWriter traceFileWriter(TraceProperties properties) {
        var t = properties.trace();
        String dir = t.directory();
        String prefix = t.filePrefix();
        boolean async = t.async();
        int retention = t.retentionDays();
        return new TraceFileWriter(dir, prefix, async, retention);
    }

    @Bean
    @ConditionalOnMissingBean
    public TracingAspect tracingAspect(
            ObjectProvider<ObserveStore> observeStoreProvider,
            ObjectProvider<TraceFileWriter> traceFileWriterProvider,
            TraceProperties properties
    ) {
        List<String> maskKeys = (properties.trace() != null) ? properties.trace().maskKeys() : List.of();
        return new TracingAspect(observeStoreProvider.getIfAvailable(), traceFileWriterProvider.getIfAvailable(), maskKeys);
    }

//    @Bean
//    @ConditionalOnWebApplication
//    @ConditionalOnProperty(
//            prefix = "service.observing.observe",
//            name = "enabled",
//            havingValue = "true"
//    )
//    @ConditionalOnMissingBean
//    public SessionController sessionController(ObserveProperties properties) {
//        String title = (properties.observe() != null) ? properties.observe().title() : "API Observability";
//        return new SessionController(title, properties.getPath());
//    }
//
//    @Bean
//    @ConditionalOnWebApplication
//    @ConditionalOnProperty(
//            prefix = "service.observing.observe",
//            name = "enabled",
//            havingValue = "true"
//    )
//    @ConditionalOnMissingBean
//    public ObservedEndpointScanner observedEndpointScanner(ApplicationContext applicationContext, ObserveProperties properties) {
//        return new ObservedEndpointScanner(applicationContext, properties.getPath());
//    }

    @Bean
    @ConditionalOnWebApplication
    @ConditionalOnProperty(
            prefix = "service.observing.observe",
            name = "enabled",
            havingValue = "true"
    )
    @ConditionalOnMissingBean
    public ObservabilityStartupListener observabilityStartupListener(ObserveProperties properties) {
        return new ObservabilityStartupListener(properties);
    }

//    @Bean
//    @ConditionalOnWebApplication
//    @ConditionalOnProperty(
//            prefix = "service.observing.observe",
//            name = "enabled",
//            havingValue = "true"
//    )
//    @ConditionalOnMissingBean(name = "observabilitySecurityFilterChain")
//    public ObserveApiController observeApiController
//            (ObserveStore observeStore, ObjectProvider<ObservedEndpointScanner> scannerProvider,
//             ClickHouseTraceRepository clickHouseTraceRepository) {
//        return new ObserveApiController(observeStore, clickHouseTraceRepository, scannerProvider.getIfAvailable());
//    }
//
//    @Bean
//    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
//    @ConditionalOnClass(SseTraceService.class)
//    @ConditionalOnProperty(
//            prefix = "service.tracing.trace",
//            name = "enabled",
//            havingValue = "true",
//            matchIfMissing = true
//    )
//    @ConditionalOnMissingBean(name = "sseTraceService")
//    public SseTraceService sseTraceService(ClickHouseTraceRepository repository) {
//        SseTraceService service = new SseTraceService(repository);
//        service.start();
//        return service;
//    }
//
//    @Bean
//    @Order(Ordered.LOWEST_PRECEDENCE - 5)
//    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
//    @ConditionalOnClass(SecurityFilterChain.class, HttpSecurity.class)
//    @ConditionalOnProperty(
//            prefix = "service.observing.observe",
//            name = "enabled",
//            havingValue = "true"
//    )
//    @ConditionalOnMissingBean(name = "observabilitySecurityFilterChain")
//    public SecurityFilterChain observabilitySecurityFilterChain(
//            HttpSecurity http,
//            ObserveProperties properties,
//            Environment environment) throws Exception {
//        var obs = properties.observe();
//        String username = (obs != null && obs.username() != null && !obs.username().isBlank())
//                ? obs.username() : "admin";
//        String password = (obs != null && obs.password() != null && !obs.password().isBlank())
//                ? obs.password() : "admin";
//        validateCredentials(username, password, environment);
//        SecurityConfiguration security = new SecurityConfiguration(username, password, properties.getPath());
//        return security.buildFilterChain(http);
//    }
//
//    @Bean
//    @Order(Ordered.LOWEST_PRECEDENCE - 5)
//    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
//    @ConditionalOnClass(SecurityFilterChain.class, HttpSecurity.class)
//    @ConditionalOnProperty(
//            prefix = "service.observing.observe",
//            name = "enabled",
//            havingValue = "false",
//            matchIfMissing = true
//    )
//    @ConditionalOnMissingBean(SecurityFilterChain.class)
//    public SecurityFilterChain noObserveSecurityFilterChain(HttpSecurity http, ObserveProperties properties) throws Exception {
//        String path = properties.getPath();
//        http.securityMatcher(path, path + "/**")
//                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
//                .csrf(org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer::disable);
//        return http.build();
//    }
//
//    @Bean
//    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
//    @ConditionalOnClass(UserDetailsService.class)
//    @ConditionalOnProperty(
//            prefix = "service.observing.observe",
//            name = "enabled",
//            havingValue = "true"
//    )
//    @ConditionalOnMissingBean({UserDetailsService.class, org.springframework.security.authentication.AuthenticationManager.class, org.springframework.security.authentication.AuthenticationProvider.class})
//    public UserDetailsService userDetailsService(ObserveProperties properties, Environment environment) {
//        var obs = properties.observe();
//        String username = (obs != null && obs.username() != null && !obs.username().isBlank())
//                ? obs.username() : "admin";
//        String password = (obs != null && obs.password() != null && !obs.password().isBlank())
//                ? obs.password() : "admin";
//        validateCredentials(username, password, environment);
//        var encoder = new BCryptPasswordEncoder();
//        var user = User.withUsername(username)
//                .password(encoder.encode(password))
//                .roles("OBSERVABILITY_USER")
//                .build();
//        return new InMemoryUserDetailsManager(user);
//    }
//
//    @Bean
//    @ConditionalOnClass(PasswordEncoder.class)
//    @ConditionalOnProperty(
//            prefix = "service.observing.observe",
//            name = "enabled",
//            havingValue = "true"
//    )
//    @ConditionalOnMissingBean(PasswordEncoder.class)
//    public PasswordEncoder passwordEncoder() {
//        return new BCryptPasswordEncoder();
//    }
//
//    private void validateCredentials(String username, String password, Environment environment) {
//        boolean isDefault = "admin".equalsIgnoreCase(username) && "admin".equalsIgnoreCase(password);
//        if (isDefault) {
//            boolean isProd = environment != null && environment.acceptsProfiles(
//                    Profiles.of("prod", "production", "live", "stage", "staging")
//            );
//
//            if (isProd) {
//                log.warn("""
//                        API Observability Security Warning: Insecure default credentials ('admin'/'admin')
//                        are being used under a production/staging profile!
//                        Please configure 'service.observing.observe.username' and
//                        'service.observing.observe.password' via environment variables
//                        or secure configuration.
//                        """);
//            } else {
//                log.warn("""
//                        API Observability is configured with default credentials ('admin'/'admin').
//                        For production deployments, configure custom credentials via
//                        'service.observing.observe.username' and 'service.observing.observe.password'.
//                        """);
//            }
//        }
//    }
}
