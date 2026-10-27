package io.github.pranit.security;

import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.configurers.RequestCacheConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Set;

public class SecurityConfiguration {

    private static final String DEFAULT_ROLE = "ADMIN";
    private static final String[] DEFAULT_ROLES = {"ADMIN", "DEVELOPER"};
    private static final PasswordEncoder ENCODER = new BCryptPasswordEncoder();

    private final String username;
    private final String password;
    private final String[] roles;
    private final String endpoint;
    private final PublicEndpointProvider publicEndpoints;

    public SecurityConfiguration(
            String username, String password, String role,
            String endpoint, PublicEndpointProvider publicEndpoints) {
        this.username = username;
        this.password = password;
        if (role == null || role.isBlank()) {
            this.roles = DEFAULT_ROLES;
        } else {
            this.roles = Arrays.stream(role.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .map(s -> s.startsWith("ROLE_") ? s.substring(5) : s)
                    .toArray(String[]::new);
        }
        this.endpoint = (endpoint != null && !endpoint.isBlank()) ? endpoint.trim() : "/obs";
        this.publicEndpoints = publicEndpoints != null
                ? publicEndpoints : new PublicEndpointProvider(this.endpoint);
    }

    public SecurityConfiguration(
            String username, String password, String[] roles,
            String endpoint, PublicEndpointProvider publicEndpoints) {
        this.username = username;
        this.password = password;
        if (roles == null || roles.length == 0) {
            this.roles = DEFAULT_ROLES;
        } else {
            this.roles = Arrays.stream(roles)
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .map(s -> s.startsWith("ROLE_") ? s.substring(5) : s)
                    .toArray(String[]::new);
        }
        this.endpoint = (endpoint != null && !endpoint.isBlank()) ? endpoint.trim() : "/obs";
        this.publicEndpoints = publicEndpoints != null
                ? publicEndpoints : new PublicEndpointProvider(this.endpoint);
    }

    /**
     * Backward compatible constructor.
     */
    public SecurityConfiguration(String username, String password, String endpoint) {
        this(username, password, DEFAULT_ROLES, endpoint, null);
    }

    public SecurityFilterChain buildFilterChain(HttpSecurity http) throws Exception {
        if (username == null || username.isBlank() || password == null || password.isBlank()) {
            throw new IllegalStateException("Credentials required for API Observability when observe is enabled!");
        }

        var user = User.withUsername(username)
                .password(ENCODER.encode(password))
                .roles(roles)
                .build();

        var authenticationProvider = new DaoAuthenticationProvider(new InMemoryUserDetailsManager(user));
        authenticationProvider.setPasswordEncoder(ENCODER);
        var authenticationManager = new ProviderManager(authenticationProvider);

        String loginPath = endpoint + "/auth/login";
        String logoutPath = endpoint + "/auth/logout";

        Set<String> authorizedRolesSet = new LinkedHashSet<>();
        authorizedRolesSet.add("ADMIN");
        authorizedRolesSet.add("DEVELOPER");
        for (String r : roles) {
            authorizedRolesSet.add(r);
        }
        String[] authorizedRoles = authorizedRolesSet.toArray(new String[0]);

        http.securityMatcher(endpoint, endpoint + "/**")
                .csrf(AbstractHttpConfigurer::disable)
                .authenticationManager(authenticationManager)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(publicEndpoints.getPublicEndpoints()).permitAll()
                        .anyRequest().hasAnyRole(authorizedRoles))
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
        return (roles != null && roles.length > 0) ? roles[0] : DEFAULT_ROLE;
    }

    public String[] getRoles() {
        return roles != null ? roles.clone() : DEFAULT_ROLES;
    }

    public String getEndpoint() {
        return endpoint;
    }
}
