package io.github.pranit.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * REST Controller exposing the observability session state and navigation.
 */
@RestController
public class AuthController {

    private final String title;
    private final String endpoint;
    private final String role;
    private final List<String> authorizedRoles;

    public AuthController() {
        this("API Observability", "/obs", "ADMIN");
    }

    public AuthController(String title, String endpoint) {
        this(title, endpoint, "ADMIN");
    }

    public AuthController(String title, String endpoint, String role) {
        this.title = (title != null && !title.isBlank()) ? title : "API Observability";
        this.endpoint = (endpoint != null && !endpoint.isBlank()) ? endpoint : "/obs";
        this.role = (role != null && !role.isBlank()) ? role : "ADMIN";

        List<String> parsed = new ArrayList<>();
        parsed.add("ADMIN");
        parsed.add("DEVELOPER");
        if (role != null && !role.isBlank()) {
            for (String r : role.split(",")) {
                String clean = r.trim().startsWith("ROLE_") ? r.trim().substring(5) : r.trim();
                if (!clean.isEmpty() && !parsed.contains(clean)) {
                    parsed.add(clean);
                }
            }
        }
        this.authorizedRoles = parsed;
    }

    @GetMapping("${service.observing.observe.endpoint:/obs}/login")
    public ResponseEntity<Void> login() {
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(endpoint + "/"))
                .build();
    }

    @GetMapping("${service.observing.observe.endpoint:/obs}/auth/session")
    public Map<String, Object> session(Authentication authentication, HttpServletRequest request) {
        boolean authenticated = authentication != null
                && authentication.isAuthenticated()
                && authentication.getAuthorities()
                .stream()
                .anyMatch(a -> {
                    String auth = a.getAuthority();
                    if (auth == null) return false;
                    String clean = auth.startsWith("ROLE_") ? auth.substring(5) : auth;
                    for (String authorized : authorizedRoles) {
                        if (authorized.equalsIgnoreCase(clean)) {
                            return true;
                        }
                    }
                    return "OBSERVABILITY_ADMIN".equalsIgnoreCase(clean)
                            || "OBSERVABILITY_USER".equalsIgnoreCase(clean);
                });

        HttpSession session = request.getSession(false);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("authenticated", authenticated);
        response.put("title", title);
        if (authenticated) {
            response.put("username", authentication.getName());

            String activeRole = authentication.getAuthorities().stream()
                    .map(GrantedAuthority::getAuthority)
                    .filter(Objects::nonNull)
                    .map(a -> a.startsWith("ROLE_") ? a.substring(5) : a)
                    .filter(a -> "ADMIN".equalsIgnoreCase(a) || "DEVELOPER".equalsIgnoreCase(a))
                    .findFirst()
                    .orElse(this.role.startsWith("ROLE_") ? this.role.substring(5) : this.role);

            response.put("role", activeRole);
            response.put("roles", List.of("ADMIN", "DEVELOPER"));
            response.put("observe", Map.of("endpoint", endpoint));
            if (session != null) {
                response.put("sessionId", session.getId());
            }
        } else {
            response.put("username", "");
        }
        return response;
    }

    public String getTitle() {
        return title;
    }

    public String getEndpoint() {
        return endpoint;
    }

    public String getRole() {
        return role;
    }
}
