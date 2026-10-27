package io.github.pranit.discovery;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.pranit.annotation.Observe;
import io.github.pranit.annotation.Trace;
import io.github.pranit.model.ObservedEndpoint;
import org.springframework.context.ApplicationContext;
import org.springframework.context.event.ContextRefreshedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.lang.reflect.Parameter;
import java.lang.reflect.RecordComponent;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Discovers and indexes controller endpoints that have @Observe or @Trace annotations.
 */
public class ObservedEndpointScanner {

    private final ApplicationContext applicationContext;
    private final String baseEndpoint;
    private final List<ObservedEndpoint> discoveredEndpoints = new CopyOnWriteArrayList<>();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ObservedEndpointScanner(ApplicationContext applicationContext) {
        this(applicationContext, "/obs");
    }

    public ObservedEndpointScanner(ApplicationContext applicationContext, String baseEndpoint) {
        this.applicationContext = applicationContext;
        this.baseEndpoint = (baseEndpoint != null && !baseEndpoint.isBlank()) ? baseEndpoint : "/obs";
    }

    @EventListener(ContextRefreshedEvent.class)
    public void onApplicationEvent() {
        scan();
    }

    /**
     * Scans all RequestMappingHandlerMappings in the application context for @Observe / @Trace endpoints.
     */
    public synchronized List<ObservedEndpoint> scan() {
        try {
            Map<String, RequestMappingHandlerMapping> mappings =
                    applicationContext.getBeansOfType(RequestMappingHandlerMapping.class);
            List<ObservedEndpoint> list = new ArrayList<>();
            for (RequestMappingHandlerMapping mapping : mappings.values()) {
                Map<RequestMappingInfo, HandlerMethod> handlerMethods = mapping.getHandlerMethods();
                for (Map.Entry<RequestMappingInfo, HandlerMethod> entry : handlerMethods.entrySet()) {
                    RequestMappingInfo info = entry.getKey();
                    HandlerMethod handlerMethod = entry.getValue();
                    Method method = handlerMethod.getMethod();
                    Class<?> beanType = handlerMethod.getBeanType();
                    // Check if method or class has @Observe or @Trace
                    Observe observe = AnnotationUtils.findAnnotation(method, Observe.class);
                    if (observe == null) {
                        observe = AnnotationUtils.findAnnotation(beanType, Observe.class);
                    }
                    Trace trace = AnnotationUtils.findAnnotation(method, Trace.class);
                    if (trace == null) {
                        trace = AnnotationUtils.findAnnotation(beanType, Trace.class);
                    }
                    // Only include endpoints with @Observe or @Trace
                    if (observe == null && trace == null) continue;
                    // Extract patterns / URLs
                    Set<String> patterns = info.getPatternValues();
                    if (patterns.isEmpty()) {
                        if (info.getPathPatternsCondition() != null) {
                            patterns = info.getPathPatternsCondition().getPatternValues();
                        }
                    }
                    if (patterns.isEmpty()) continue;
                    // Extract HTTP methods
                    Set<RequestMethod> requestMethods = info.getMethodsCondition().getMethods();
                    List<String> httpMethods = requestMethods.isEmpty()
                            ? List.of("GET") : requestMethods.stream().map(Enum::name).toList();
                    for (String path : patterns) {
                        // Skip internal observability and error endpoints
                        if (path.startsWith(baseEndpoint) || path.startsWith("/obs") || path.startsWith("/error")) {
                            continue;
                        }
                        for (String httpMethod : httpMethods) {
                            String id = httpMethod + ":" + path;
                            String description = null;
                            if (observe != null) {
                                if (!observe.value().isBlank()) {
                                    description = observe.value();
                                } else if (!observe.name().isBlank()) {
                                    description = observe.name();
                                }
                            }
                            if (description == null && trace != null) {
                                if (!trace.value().isBlank()) {
                                    description = trace.value();
                                } else if (!trace.name().isBlank()) {
                                    description = trace.name();
                                }
                            }
                            if (description == null) {
                                description = beanType.getSimpleName() + "." + method.getName();
                            }
                            String requestBodyType = null;
                            String sampleBody = null;
                            Map<String, String> sampleHeaders = new LinkedHashMap<>();
                            if ("POST".equalsIgnoreCase(httpMethod)
                                    || "PUT".equalsIgnoreCase(httpMethod)
                                    || "PATCH".equalsIgnoreCase(httpMethod)) {
                                sampleHeaders.put("Content-Type", "application/json");
                                for (Parameter param : method.getParameters()) {
                                    if (param.isAnnotationPresent(RequestBody.class)) {
                                        Class<?> bodyType = param.getType();
                                        requestBodyType = bodyType.getName();
                                        sampleBody = generateSampleJson(bodyType);
                                        break;
                                    }
                                }
                            }
                            list.add(new ObservedEndpoint(
                                    id, httpMethod, path, beanType.getSimpleName(),
                                    method.getName(), description, requestBodyType, sampleBody, sampleHeaders)
                            );
                        }
                    }
                }
            }
            discoveredEndpoints.clear();
            discoveredEndpoints.addAll(list);
        } catch (Exception ignored) {
        }
        return Collections.unmodifiableList(discoveredEndpoints);
    }

    private String generateSampleJson(Class<?> type) {
        if (type == null || type.equals(Void.class) || type.equals(void.class)) return null;
        try {
            Map<String, Object> sampleMap = new LinkedHashMap<>();
            if (type.isRecord()) {
                for (RecordComponent rc : type.getRecordComponents()) {
                    sampleMap.put(rc.getName(), generateDefaultValue(rc.getName(), rc.getType()));
                }
            } else {
                Class<?> curr = type;
                while (curr != null && curr != Object.class) {
                    for (Field field : curr.getDeclaredFields()) {
                        if (Modifier.isStatic(field.getModifiers()) || Modifier.isTransient(field.getModifiers()))
                            continue;
                        sampleMap.put(field.getName(), generateDefaultValue(field.getName(), field.getType()));
                    }
                    curr = curr.getSuperclass();
                }
            }
            if (sampleMap.isEmpty()) return "{}";
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(sampleMap);
        } catch (Exception e) {
            return "{}";
        }
    }

    private Object generateDefaultValue(String name, Class<?> fieldType) {
        if (fieldType == String.class || CharSequence.class.isAssignableFrom(fieldType)) {
            return "";
        } else if (fieldType == int.class || fieldType == Integer.class) {
            return 0;
        } else if (fieldType == long.class || fieldType == Long.class) {
            return 0L;
        } else if (fieldType == double.class || fieldType == Double.class
                || fieldType == float.class || fieldType == Float.class
                || fieldType == BigDecimal.class) {
            return 0.0;
        } else if (fieldType == boolean.class || fieldType == Boolean.class) {
            return false;
        } else if (List.class.isAssignableFrom(fieldType) || Set.class.isAssignableFrom(fieldType)) {
            return List.of();
        } else if (Map.class.isAssignableFrom(fieldType)) {
            return Map.of();
        }
        return "";
    }

    /**
     * Returns the cached discovered endpoints, or runs a scan if not yet indexed.
     */
    public List<ObservedEndpoint> getDiscoveredEndpoints() {
        if (discoveredEndpoints.isEmpty()) return scan();
        return Collections.unmodifiableList(discoveredEndpoints);
    }
}
