package io.github.pranit.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/**
 * REST Controller exposing the observability session state and navigation.
 */
@RestController
public class AuthController {

    private final String title;
    private final String endpoint;

    public AuthController() {
        this("API Observability", "/obs");
    }

    public AuthController(String title, String endpoint) {
        this.title = (title != null && !title.isBlank()) ? title : "API Observability";
        this.endpoint = (endpoint != null && !endpoint.isBlank()) ? endpoint : "/obs";
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
                .anyMatch(a -> Objects.equals(a.getAuthority(), "ROLE_OBSERVABILITY_USER")
                        || Objects.equals(a.getAuthority(), "OBSERVABILITY_ADMIN"));
        HttpSession session = request.getSession(false);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("authenticated", authenticated);
        response.put("title", title);
        if (authenticated) {
            response.put("username", authentication.getName());
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
}
