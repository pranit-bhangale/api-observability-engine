package io.github.pranit.model;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Detailed representation of a captured method return value / output argument.
 */
public record ReturnDetail(
        String type,
        Object value,
        boolean sensitive
) {
    public Map<String, Object> toMap() {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("type", type);
        map.put("value", value);
        map.put("sensitive", sensitive);
        return map;
    }
}
