package io.github.pranit.security;

import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.configurers.RequestCacheConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;

public class SecurityConfiguration {

    private static final String DEFAULT_ROLE = "OBSERVABILITY_ADMIN";

    private final String username;
    private final String password;
    private final String role;
    private final String endpoint;
    private final PublicEndpointProvider publicEndpoints;

    public SecurityConfiguration(
            String username, String password, String role,
            String endpoint, PublicEndpointProvider publicEndpoints) {
        this.username = username;
        this.password = password;
        this.role = (role != null && !role.isBlank())
                ? role : DEFAULT_ROLE;
        this.endpoint = (endpoint != null && !endpoint.isBlank())
                ? endpoint : "/obs";
        this.publicEndpoints = publicEndpoints != null
                ? publicEndpoints : new PublicEndpointProvider(this.endpoint);
    }

    /**
     * Backward compatible constructor.
     */
    public SecurityConfiguration(String username, String password, String endpoint) {
        this(username, password, DEFAULT_ROLE, endpoint, null);
    }

    public SecurityFilterChain buildFilterChain(HttpSecurity http) throws Exception {
        if (username == null || username.isBlank() || password == null || password.isBlank()) {
            throw new IllegalStateException("Credentials required for API Observability when observe is enabled!");
        }
        var encoder = new BCryptPasswordEncoder();
        var user = User.withUsername(username)
                .password(encoder.encode(password))
                .roles(role)
                .build();
        var authenticationProvider = new DaoAuthenticationProvider(new InMemoryUserDetailsManager(user));
        authenticationProvider.setPasswordEncoder(encoder);
        var authenticationManager = new ProviderManager(authenticationProvider);
        String loginPath = endpoint + "/auth/login";
        String logoutPath = endpoint + "/auth/logout";
        http.securityMatcher(endpoint, endpoint + "/**")
                .csrf(AbstractHttpConfigurer::disable)
                .authenticationManager(authenticationManager)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(publicEndpoints.getPublicEndpoints()).permitAll()
                        .anyRequest().hasRole(role))
                .requestCache(RequestCacheConfigurer::disable)
                .formLogin(form -> form
                        .loginPage(endpoint + "/login")
                        .loginProcessingUrl(loginPath)
                        .successHandler((_, response, _) -> response.setStatus(204))
                        .failureHandler((_, response, _) -> {
                            response.setStatus(401);
                            response.setContentType("application/json");
                            response.getWriter().write("{\"error\":\"Invalid username or password\"}");
                        }))
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                .logout(logout -> logout
                        .logoutUrl(logoutPath)
                        .invalidateHttpSession(true)
                        .clearAuthentication(true)
                        .deleteCookies("JSESSIONID")
                        .logoutSuccessHandler((_, response, _) -> response.setStatus(204)))
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((_, response, _) -> {
                            response.setStatus(401);
                            response.setContentType("application/json");
                            response.getWriter().write("{\"error\":\"Sign in to continue\"}");
                        }));

        return http.build();
    }

    public String getUsername() {
        return username;
    }

    public String getRole() {
        return role;
    }

    public String getEndpoint() {
        return endpoint;
    }
}