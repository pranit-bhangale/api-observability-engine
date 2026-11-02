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
import org.jspecify.annotations.NonNull;
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
import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.context.annotation.Conditional;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.type.AnnotatedTypeMetadata;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
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
    @ConditionalOnMissingBean
    public ServiceProperties.ObserveSettings observeSettings(ServiceProperties service) {
        return (service != null && service.observing() != null)
                ? service.observing()
                : new ServiceProperties.ObserveSettings(new ServiceProperties.ObserveConfig(
                true, "/obs", "API Observability", 500));
    }

    @Bean
    @ConditionalOnMissingBean
    public ServiceProperties.ObserveConfig observeConfig(ServiceProperties.ObserveSettings observeSettings) {
        return (observeSettings != null && observeSettings.observe() != null)
                ? observeSettings.observe()
                : new ServiceProperties.ObserveConfig(
                true, "/obs", "API Observability", 500);
    }

    @Bean
    @ConditionalOnMissingBean
    public ServiceProperties.ObserveSecuritySettings observeSecuritySettings(ServiceProperties service) {
        return (service != null && service.observe() != null)
                ? service.observe()
                : new ServiceProperties.ObserveSecuritySettings(
                "ADMIN,DEVELOPER", "admin", "admin");
    }

    @Bean
    @ConditionalOnMissingBean
    public ServiceProperties.TraceSettings traceSettings(ServiceProperties service) {
        return (service != null && service.tracing() != null)
                ? service.tracing()
                : new ServiceProperties.TraceSettings(
                true, "", "trace", 14, true, List.of());
    }

    @Bean
    @ConditionalOnMissingBean(ObserveStore.class)
    @ConditionalOnProperty(
            prefix = "service.clickhouse",
            name = "enabled",
            havingValue = "false",
            matchIfMissing = true
    )
    public ObserveStore observeStore(ServiceProperties service) {
        var observeConfig = (service != null && service.observing() != null) ? service.observing().observe() : null;
        int maxTraces = (observeConfig != null) ? observeConfig.maxTraces() : 500;
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
    public TraceFileWriter traceFileWriter(ServiceProperties service) {
        var tracing = (service != null && service.tracing() != null)
                ? service.tracing()
                : new ServiceProperties.TraceSettings(
                true, "", "trace", 14, true, List.of());
        String dir = tracing.directory();
        String prefix = tracing.filePrefix();
        boolean async = tracing.async();
        int retention = tracing.retentionDays();
        return new TraceFileWriter(dir, prefix, async, retention);
    }

    @Bean
    @ConditionalOnMissingBean
    public TracingAspect tracingAspect(
            ObjectProvider<ObserveStore> observeStoreProvider,
            ObjectProvider<TraceFileWriter> traceFileWriterProvider,
            ServiceProperties service
    ) {
        var tracing = (service != null) ? service.tracing() : null;
        List<String> maskKeys = (tracing != null) ? tracing.maskKeys() : List.of();
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
    public AuthController authController(ServiceProperties service) {
        var observe = (service != null && service.observing() != null) ? service.observing().observe() : null;
        String title = (observe != null) ? observe.title() : "API Observability";
        String endpoint = (service != null && service.observing() != null) ? service.observing().getPath() : "/obs";
        String role = (service != null && service.observe() != null && service.observe().role() != null)
                ? service.observe().role() : "ADMIN,DEVELOPER";
        return new AuthController(title, endpoint, role);
    }

    @Bean
    @ConditionalOnWebApplication
    @ConditionalOnProperty(
            prefix = "service.observing.observe",
            name = "enabled",
            havingValue = "true"
    )
    @Conditional(OnUiResourceCondition.class)
    @ConditionalOnMissingBean
    public ObservabilityWebMvcConfigurer observabilityWebMvcConfigurer(ServiceProperties service) {
        var observeSettings = (service != null) ? service.observing() : null;
        return new ObservabilityWebMvcConfigurer(observeSettings);
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
            (ApplicationContext applicationContext, ServiceProperties service) {
        String path = (service != null && service.observing() != null) ? service.observing().getPath() : "/obs";
        return new ObservedEndpointScanner(applicationContext, path);
    }

    @Bean
    @ConditionalOnWebApplication
    @ConditionalOnProperty(
            prefix = "service.observing.observe",
            name = "enabled",
            havingValue = "true"
    )
    @ConditionalOnMissingBean
    public ObservabilityStartupListener observabilityStartupListener(ServiceProperties service) {
        var observeSettings = (service != null) ? service.observing() : null;
        return new ObservabilityStartupListener(observeSettings);
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
            HttpSecurity http, ServiceProperties service) throws Exception {
        var properties = (service != null) ? service.observe() : null;
        var path = (service != null) ? service.observing() : null;
        String endpoint = (path != null) ? path.getPath() : "/obs";
        String username = (properties != null
                && properties.username() != null && !properties.username().isBlank())
                ? properties.username() : "admin";
        String password = (properties != null
                && properties.password() != null && !properties.password().isBlank())
                ? properties.password() : "admin";
        String[] roles = (properties != null && properties.roles().length > 0)
                ? properties.roles() : new String[]{"ADMIN", "DEVELOPER"};
        validateCredentials(username, password);
        SecurityConfiguration security = new SecurityConfiguration(username, password, roles, endpoint, null);
        return security.buildFilterChain(http);
    }

    private void validateCredentials(String username, String password) {
        boolean isDefault = "admin".equalsIgnoreCase(username) && "admin".equalsIgnoreCase(password);
        if (isDefault) {
            LOG.warn("""
                    API Observability is configured with default credentials ('admin'/'admin').
                    """);
        }
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
    public SecurityFilterChain noObserveSecurityFilterChain(HttpSecurity http, ServiceProperties service) {
        String path = (service != null && service.observing() != null)
                ? service.observing().getPath() : "/obs";
        http.securityMatcher(path, path + "/**")
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
                .csrf(AbstractHttpConfigurer::disable);
        return http.build();
    }

    @Bean
    @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
    @ConditionalOnClass(UserDetailsService.class)
    @ConditionalOnMissingBean({UserDetailsService.class, AuthenticationManager.class, AuthenticationProvider.class})
    public UserDetailsService userDetailsService(ServiceProperties service, ObjectProvider<PasswordEncoder> encoders) {
        var properties = (service != null) ? service.observe() : null;
        String username = (properties != null
                && properties.username() != null && !properties.username().isBlank())
                ? properties.username() : "admin";
        String password = (properties != null
                && properties.password() != null && !properties.password().isBlank())
                ? properties.password() : "admin";
        validateCredentials(username, password);
        String[] roles = (properties != null && properties.roles().length > 0)
                ? properties.roles() : new String[]{"ADMIN", "DEVELOPER"};
        PasswordEncoder encoder = encoders.getIfAvailable(BCryptPasswordEncoder::new);
        var user = User.withUsername(username)
                .password(encoder.encode(password))
                .roles(roles)
                .build();
        return new InMemoryUserDetailsManager(user);
    }

    @Bean
    @ConditionalOnClass(PasswordEncoder.class)
    @ConditionalOnMissingBean(PasswordEncoder.class)
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * Condition matching when the UI static bundle (from api-observability-ui) is present on classpath.
     * When api-observability-ui is excluded, this condition evaluates to false, enabling zero-footprint Headless Mode.
     */
    static class OnUiResourceCondition implements Condition {
        @Override
        public boolean matches(ConditionContext context, @NonNull AnnotatedTypeMetadata metadata) {
            var loader = context.getResourceLoader();
            return loader.getResource("classpath:/static/obs/index.html").exists()
                    || loader.getResource("classpath:/META-INF/resources/obs/index.html").exists();
        }
    }
}
