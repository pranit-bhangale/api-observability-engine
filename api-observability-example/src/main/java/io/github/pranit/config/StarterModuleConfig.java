package io.github.pranit.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.configurers.HeadersConfigurer;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;

import java.util.Arrays;

/**
 * Starter Module Configuration & Customization.
 * The api-observability-starter auto-configures:
 * 1. TracingAspect (AOP interception on @Observe / @Trace and Spring beans)
 * 2. InMemoryObserveStore (Ring-buffer storage for live trace visualizer)
 * 3. TraceFileWriter (Asynchronous disk persistence for telemetry records)
 * 4. AuthController & ObserveApiController (Secure REST APIs at /obs/api/*)
 * 5. ObservabilityWebMvcConfigurer (Dashboard UI routing at /obs)
 */
@Configuration
public class StarterModuleConfig {

    private static final Logger log = LoggerFactory.getLogger(StarterModuleConfig.class);

    public StarterModuleConfig() {
        log.info("API Observability Starter integration active: capturing deep method call telemetry.");
    }

    @Bean
    @ConditionalOnMissingBean
    public ObjectMapper objectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.findAndRegisterModules();
        return mapper;
    }

    @Bean
    @ConditionalOnMissingBean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * Registers UserDetailsService from YAML configuration (service.observe.username/password).
     * Binds strictly to YAML and prevents Spring Boot from generating a random security password at startup.
     */
    @Bean
    @ConditionalOnMissingBean
    public UserDetailsService userDetailsService(
            @Value("${service.observe.username:admin}") String username,
            @Value("${service.observe.password:admin}") String password,
            @Value("${service.observe.role:ADMIN,DEVELOPER}") String role,
            PasswordEncoder passwordEncoder) {
        String[] roles = Arrays.stream(role.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> s.startsWith("ROLE_") ? s.substring(5) : s)
                .toArray(String[]::new);

        UserDetails user = User.withUsername(username)
                .password(passwordEncoder.encode(password))
                .roles(roles)
                .build();
        return new InMemoryUserDetailsManager(user);
    }

    /**
     * Application security chain for the Todo REST API and H2 Console.
     * Observability dashboard (/obs/**) is independently secured with higher precedence by the starter.
     */
    @Bean
    @Order(Ordered.LOWEST_PRECEDENCE)
    public SecurityFilterChain appSecurityFilterChain(HttpSecurity http) throws Exception {
        http.securityMatcher("/api/**", "/h2-console/**")
                .csrf(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
                .headers(headers -> headers.frameOptions(HeadersConfigurer.FrameOptionsConfig::disable));
        return http.build();
    }
}
