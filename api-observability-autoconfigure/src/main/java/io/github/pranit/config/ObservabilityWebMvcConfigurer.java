package io.github.pranit.config;

import io.github.pranit.properties.ServiceProperties;
import org.jspecify.annotations.NonNull;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

import java.io.IOException;

/**
 * Web MVC configuration for the observability dashboard.
 */
public class ObservabilityWebMvcConfigurer implements WebMvcConfigurer {

    private final ServiceProperties.ObserveSettings properties;

    public ObservabilityWebMvcConfigurer(ServiceProperties.ObserveSettings properties) {
        this.properties = properties;
    }

    @Override
    public void addViewControllers(@NonNull ViewControllerRegistry registry) {
        String path = properties.getPath();
        if (path != null && !path.isEmpty() && !"/".equals(path)) {
            registry.addRedirectViewController(path, path + "/");
        }
        registry.addViewController(path + "/").setViewName("forward:" + path + "/index.html");
        registry.addViewController(path + "/login").setViewName("forward:" + path + "/index.html");
    }

    @Override
    public void addResourceHandlers(@NonNull ResourceHandlerRegistry registry) {
        String path = properties.getPath();
        String pattern = (path != null && !path.isEmpty()) ? path : "/obs";
        registry.addResourceHandler(pattern + "/**")
                .addResourceLocations("classpath:/static/obs/")
                .resourceChain(true)
                .addResolver(new PathResourceResolver() {
                    @Override
                    protected Resource getResource(@NonNull String resourcePath, @NonNull Resource location) throws IOException {
                        Resource requested = location.createRelative(resourcePath);
                        if (requested.exists() && requested.isReadable()) return requested;
                        if (!resourcePath.startsWith("api/") && !resourcePath.startsWith("auth/")) {
                            Resource index = location.createRelative("index.html");
                            if (index.exists() && index.isReadable()) return index;
                        }
                        return null;
                    }
                });
    }
}
