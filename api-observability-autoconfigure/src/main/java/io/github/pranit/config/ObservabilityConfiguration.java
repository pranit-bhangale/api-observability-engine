package io.github.pranit.config;

import io.github.pranit.aspect.TracingAspect;
import io.github.pranit.controller.AuthController;
import io.github.pranit.controller.ObserveApiController;
import io.github.pranit.discovery.ObservedEndpointScanner;
import io.github.pranit.properties.ServiceProperties;
import io.github.pranit.security.SecurityConfiguration;
import io.github.pranit.store.InMemoryObserveStore;
import io.github.pranit.store.ObserveStore;
import io.github.pranit.writer.TraceFileWriter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;

import java.util.List;

@AutoConfiguration(beforeName = {
        "org.springframework.boot.security.autoconfigure.SecurityAutoConfiguration",
        "org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration",
        "org.springframework.boot.security.autoconfigure.web.servlet.ServletWebSecurityAutoConfiguration",
        "org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration",
        "org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration"
})
@EnableConfigurationProperties(ServiceProperties.class)
public class ObservabilityConfiguration {

    private static final Logger LOG = LoggerFactory.getLogger(ObservabilityConfiguration.class);

    @Bean
    @ConditionalOnMissingBean(ObserveStore.class)
    @ConditionalOnProperty(
            prefix = "service.clickhouse",
            name = "enabled",
            havingValue = "false",
            matchIfMissing = true
    )
    public ObserveStore observeStore(ServiceProperties.ObserveConfig properties) {
        int maxTraces = (properties != null) ? properties.maxTraces() : 500;
        LOG.info("API Observability: using in-memory trace store (maxTraces: {})", maxTraces);
        return InMemoryObserveStore.init(maxTraces);
    }

    @Bean(destroyMethod = "close")
    @ConditionalOnMissingBean
    @ConditionalOnProperty(
            prefix = "service.tracing",
            name = "enabled",
            havingValue = "true",
            matchIfMissing = true
    )
    public TraceFileWriter traceFileWriter(ServiceProperties.TraceSettings properties) {
        String dir = properties.directory();
        String prefix = properties.filePrefix();
        boolean async = properties.async();
        int retention = properties.retentionDays();
        return new TraceFileWriter(dir, prefix, async, retention);
    }

    @Bean
    @ConditionalOnMissingBean
    public TracingAspect tracingAspect(
            ObjectProvider<ObserveStore> observeStoreProvider,
            ObjectProvider<TraceFileWriter> traceFileWriterProvider,
            ServiceProperties.TraceSettings properties
    ) {
        List<String> maskKeys = (properties != null) ? properties.maskKeys() : List.of();
        return new TracingAspect(observeStoreProvider.getIfAvailable(), traceFileWriterProvider.getIfAvailable(), maskKeys);
    }

    @Bean
    @ConditionalOnWebApplication
    @ConditionalOnProperty(
            prefix = "service.observing.observe",
            name = "enabled",
            havingValue = "true"
    )
    @ConditionalOnMissingBean
    public AuthController authController(ServiceProperties.ObserveSettings properties) {
        String title = (properties.observe() != null) ? properties.observe().title() : "API Observability";
        return new AuthController(title, properties.getPath());
    }

    @Bean
    @ConditionalOnWebApplication
    @ConditionalOnProperty(
            prefix = "service.observing.observe",
            name = "enabled",
            havingValue = "true"
    )
    @ConditionalOnMissingBean
    public ObservedEndpointScanner observedEndpointScanner
            (ApplicationContext applicationContext, ServiceProperties.ObserveSettings properties) {
        return new ObservedEndpointScanner(applicationContext, properties.getPath());
    }

    @Bean
    @ConditionalOnWebApplication
    @ConditionalOnProperty(
            prefix = "service.observing",
            name = "enabled",
            havingValue = "true"
    )
    @ConditionalOnMissingBean
    public ObservabilityStartupListener observabilityStartupListener(ServiceProperties.ObserveSettings properties) {
        return new ObservabilityStartupListener(properties);
    }

    @Bean
    @ConditionalOnWebApplication
    @ConditionalOnProperty(
            prefix = "service.observing.observe",
            name = "enabled",
            havingValue = "true"
    )
    @ConditionalOnMissingBean
    public ObserveApiController observeApiController
            (ObserveStore observeStore, ObjectProvider<ObservedEndpointScanner> scannerProvider) {
        return new ObserveApiController(observeStore, scannerProvider.getIfAvailable());
    }

    @Bean
    @Order(Ordered.LOWEST_PRECEDENCE - 5)
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    @ConditionalOnClass({SecurityFilterChain.class, HttpSecurity.class})
    @ConditionalOnProperty(
            prefix = "service.observing.observe",
            name = "enabled",
            havingValue = "true"
    )
    @ConditionalOnMissingBean(name = "observabilitySecurityFilterChain")
    public SecurityFilterChain observabilitySecurityFilterChain(
            HttpSecurity http, ServiceProperties service, Environment environment) throws Exception {
        var properties = service.observe();
        var path = service.observing();
        String username = (properties != null
                && properties.username() != null
                && !properties.username().isBlank())
                ? properties.username() : "admin";
        String password = (properties != null
                && properties.password() != null
                && !properties.password().isBlank())
                ? properties.password() : "admin";
        validateCredentials(username, password, environment);
        SecurityConfiguration security = new SecurityConfiguration(username, password, path.getPath());
        return security.buildFilterChain(http);
    }

    @Bean
    @Order(Ordered.LOWEST_PRECEDENCE - 5)
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    @ConditionalOnClass({SecurityFilterChain.class, HttpSecurity.class})
    @ConditionalOnProperty(
            prefix = "service.observing.observe",
            name = "enabled",
            havingValue = "false",
            matchIfMissing = true
    )
    @ConditionalOnMissingBean(SecurityFilterChain.class)
    public SecurityFilterChain noObserveSecurityFilterChain
            (HttpSecurity http, ServiceProperties.ObserveSettings properties) {
        String path = properties.getPath();
        http.securityMatcher(path, path + "/**")
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
                .csrf(org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer::disable);
        return http.build();
    }

    @Bean
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    @ConditionalOnClass(UserDetailsService.class)
    @ConditionalOnProperty(
            prefix = "service.observe",
            name = "enabled",
            havingValue = "true"
    )
    @ConditionalOnMissingBean({UserDetailsService.class, AuthenticationManager.class, AuthenticationProvider.class})
    public UserDetailsService userDetailsService
            (ServiceProperties.ObserveSecuritySettings properties, Environment environment) {
        String username = (properties != null
                && properties.username() != null
                && !properties.username().isBlank())
                ? properties.username() : "admin";
        String password = (properties != null
                && properties.password() != null
                && !properties.password().isBlank())
                ? properties.password() : "admin";
        validateCredentials(username, password, environment);
        var encoder = new BCryptPasswordEncoder();
        var user = User.withUsername(username)
                .password(encoder.encode(password))
                .roles(properties != null ? properties.normalizedRole() : "OBSERVABILITY_ADMIN")
                .build();
        return new InMemoryUserDetailsManager(user);
    }

    @Bean
    @ConditionalOnClass(PasswordEncoder.class)
    @ConditionalOnProperty(
            prefix = "service.observe",
            name = "enabled",
            havingValue = "true"
    )
    @ConditionalOnMissingBean(PasswordEncoder.class)
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    private void validateCredentials(String username, String password, Environment environment) {
        boolean isDefault = "admin".equalsIgnoreCase(username) && "admin".equalsIgnoreCase(password);
        if (isDefault) {
            boolean isProd = environment != null && environment.acceptsProfiles(
                    Profiles.of("prod", "production", "live", "stage", "staging")
            );
            if (isProd) {
                LOG.warn("""
                        API Observability Security Warning: Insecure default credentials ('admin'/'admin')
                        are being used under a production/staging profile!
                        Please configure 'service.observing.observe.username' and
                        'service.observing.observe.password' via environment variables
                        or secure configuration.
                        """);
            } else {
                LOG.warn("""
                        API Observability is configured with default credentials ('admin'/'admin').
                        For production deployments, configure custom credentials via
                        'service.observing.observe.username' and 'service.observing.observe.password'.
                        """);
            }
        }
    }
}
