package io.github.pranit.model;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Detailed representation of a captured method input argument.
 */
public record ArgumentDetail(
        String name,
        String type,
        Object value,
        boolean sensitive
) {
    public Map<String, Object> toMap() {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("name", name);
        map.put("type", type);
        map.put("value", value);
        map.put("sensitive", sensitive);
        return map;
    }
}
