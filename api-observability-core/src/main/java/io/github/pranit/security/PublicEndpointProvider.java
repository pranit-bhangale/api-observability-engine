package io.github.pranit.security;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Single place that decides which paths are reachable without logging in.
 */
public class PublicEndpointProvider {

    private final String endpoint;
    private final List<String> extraPaths;

    public PublicEndpointProvider(String endpoint, List<String> extraPaths) {
        this.endpoint = (endpoint != null && !endpoint.isBlank())
                ? endpoint : "/obs";
        this.extraPaths = extraPaths != null
                ? extraPaths : List.of();
    }

    public PublicEndpointProvider(String endpoint) {
        this(endpoint, List.of());
    }

    /**
     * Dashboard shell, login/logout/session endpoints and static resources.
     */
    public String[] getPublicEndpoints() {
        Set<String> paths = new LinkedHashSet<>();
        // dashboard entry points
        paths.add(endpoint);
        paths.add(endpoint + "/");
        paths.add(endpoint + "/index.html");
        paths.add(endpoint + "/login");
        // auth endpoints
        paths.add(endpoint + "/auth/session");
        paths.add(endpoint + "/auth/login");
        paths.add(endpoint + "/auth/logout");
        // static resources under the dashboard path
        paths.add(endpoint + "/assets/**");
        paths.add(endpoint + "/css/**");
        paths.add(endpoint + "/js/**");
        // static resources served from the root
        paths.add("/assets/**");
        paths.add("/css/**");
        paths.add("/js/**");
        paths.add("/favicon.ico");
        // user-configured extras
        paths.addAll(extraPaths);
        return paths.toArray(String[]::new);
    }
}