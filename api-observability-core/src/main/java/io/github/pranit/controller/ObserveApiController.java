package io.github.pranit.controller;

import io.github.pranit.discovery.ObservedEndpointScanner;
import io.github.pranit.model.ObservedEndpoint;
import io.github.pranit.model.TraceRecord;
import io.github.pranit.store.ObserveStore;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * REST API exposing live captured traces and discovered endpoints for the observability dashboard.
 */
@RestController
@RequestMapping("${service.observing.observe.endpoint:/obs}/api")
public class ObserveApiController {

    private final ObserveStore observeStore;
    private final ObservedEndpointScanner endpointScanner;

    public ObserveApiController() {
        this(null, null);
    }

    @Autowired
    public ObserveApiController(
            @Autowired(required = false) ObserveStore observeStore,
            @Autowired(required = false) ObservedEndpointScanner endpointScanner) {
        this.observeStore = observeStore;
        this.endpointScanner = endpointScanner;
    }

    public ObserveApiController(ObserveStore observeStore) {
        this(observeStore, null);
    }

    /**
     * Lists all application endpoints discovered with @Observe / @Trace (Swagger-like auto-discovery).
     */
    @GetMapping("/endpoints")
    public List<ObservedEndpoint> getEndpoints() {
        return endpointScanner != null ? endpointScanner.getDiscoveredEndpoints() : List.of();
    }

    /**
     * Lists all recent traces in memory.
     */
    @GetMapping("/traces")
    public List<Map<String, Object>> getTraces() {
        if (observeStore == null) return List.of();
        return observeStore.getTraces()
                .stream()
                .map(TraceRecord::toMap)
                .toList();
    }

    /**
     * Retrieves a single trace by ID.
     */
    @GetMapping("/traces/{traceId}")
    public ResponseEntity<Map<String, Object>> getTrace(@PathVariable String traceId) {
        if (observeStore == null) return ResponseEntity.notFound().build();
        return observeStore.getTrace(traceId)
                .map(TraceRecord::toMap)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /**
     * Clears all traces from memory.
     */
    @DeleteMapping("/traces")
    public ResponseEntity<Void> clearTraces() {
        if (observeStore != null) observeStore.clear();
        return ResponseEntity.noContent().build();
    }
}
