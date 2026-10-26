package io.github.pranit.capture;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.TextNode;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import io.github.pranit.model.ArgumentDetail;
import io.github.pranit.model.ReturnDetail;
import org.springframework.http.HttpEntity;

import java.lang.reflect.Method;
import java.lang.reflect.Parameter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Utility for capturing and masking method arguments and return values with full field details.
 */
public final class ValueCapture {

    private static final ObjectMapper MAPPER = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    private static final Set<String> DEFAULT_MASK_KEYS = Set.of(
            "password", "passwd", "secret", "token", "authorization",
            "apikey", "api-key", "cvv", "credentials", "privatekey"
    );

    private ValueCapture() {
    }

    /**
     * Captures structured input arguments with name, type, value, and sensitivity flags.
     */
    public static List<ArgumentDetail> captureInputDetails(
            Method method, String[] paramNames, Object[] args, int maxLen, Collection<String> extraMaskKeys) {
        if (args == null || args.length == 0) return List.of();
        Parameter[] parameters = method != null ? method.getParameters() : new Parameter[0];
        List<ArgumentDetail> details = new ArrayList<>(args.length);
        for (int i = 0; i < args.length; i++) {
            String name;
            if (paramNames != null && i < paramNames.length && paramNames[i] != null && !paramNames[i].isBlank()) {
                name = paramNames[i];
            } else if (i < parameters.length) {
                name = parameters[i].getName();
            } else {
                name = "arg" + i;
            }
            String type = (i < parameters.length)
                    ? parameters[i].getType().getName()
                    : (args[i] != null ? args[i].getClass().getName() : "java.lang.Object");
            boolean nameSensitive = isSensitive(name, extraMaskKeys);
            Object rawArg = args[i];
            if (nameSensitive) {
                details.add(new ArgumentDetail(name, type, "***", true));
            } else if (rawArg == null) {
                details.add(new ArgumentDetail(name, type, null, false));
            } else {
                MaskResult masked = maskObject(rawArg, maxLen, extraMaskKeys);
                details.add(new ArgumentDetail(name, type, masked.value, masked.wasMasked));
            }
        }
        return details;
    }

    public static List<ArgumentDetail> captureInputDetails(Method method, Object[] args, int maxLen, Collection<String> extraMaskKeys) {
        return captureInputDetails(method, null, args, maxLen, extraMaskKeys);
    }

    /**
     * Captures structured return values with type, value, and sensitivity flags.
     */
    public static ReturnDetail captureOutputDetails(Method method, Object result, int maxLen, Collection<String> extraMaskKeys) {
        Object actual = result;
        if (result instanceof HttpEntity<?> httpEntity) actual = httpEntity.getBody();
        String type = method != null ? method.getReturnType().getName() : (result != null ? result.getClass().getName() : "java.lang.Object");
        if (actual == null) {
            return new ReturnDetail(type, null, false);
        }
        MaskResult masked = maskObject(actual, maxLen, extraMaskKeys);
        return new ReturnDetail(type, masked.value, masked.wasMasked);
    }

    /**
     * Captures and serializes method arguments into a masked JSON string.
     */
    public static String captureArgs(Method method, String[] paramNames, Object[] args, int maxLen, Collection<String> extraMaskKeys) {
        if (args == null || args.length == 0) return "{}";
        Parameter[] parameters = method != null ? method.getParameters() : new Parameter[0];
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < args.length; i++) {
            String name;
            if (paramNames != null && i < paramNames.length && paramNames[i] != null && !paramNames[i].isBlank()) {
                name = paramNames[i];
            } else if (i < parameters.length) {
                name = parameters[i].getName();
            } else {
                name = "arg" + i;
            }
            map.put(name, args[i]);
        }
        return maskAndTruncateJson(map, maxLen, extraMaskKeys);
    }

    public static String captureArgs(Method method, Object[] args, int maxLen, Collection<String> extraMaskKeys) {
        return captureArgs(method, null, args, maxLen, extraMaskKeys);
    }

    /**
     * Captures and serializes a method return value into a masked JSON string.
     */
    public static String captureResult(Object result, int maxLen, Collection<String> extraMaskKeys) {
        if (result == null) return "null";
        Object actual = result;
        if (result instanceof HttpEntity<?> httpEntity) actual = httpEntity.getBody();
        if (actual == null) return "null";
        return maskAndTruncateJson(actual, maxLen, extraMaskKeys);
    }

    private static MaskResult maskObject(Object obj, int maxLen, Collection<String> extraMaskKeys) {
        if (obj == null) return new MaskResult(null, false);
        if (obj instanceof Number || obj instanceof Boolean) return new MaskResult(obj, false);
        if (obj instanceof CharSequence) {
            String str = obj.toString();
            if (maxLen > 0 && str.length() > maxLen) {
                str = str.substring(0, maxLen) + "...[truncated]";
            }
            return new MaskResult(str, false);
        }
        try {
            JsonNode tree = MAPPER.valueToTree(obj);
            AtomicBoolean wasMasked = new AtomicBoolean(false);
            maskNode(tree, extraMaskKeys, wasMasked);
            Object value = MAPPER.treeToValue(tree, Object.class);
            return new MaskResult(value, wasMasked.get());
        } catch (Exception e) {
            String str = String.valueOf(obj);
            if (maxLen > 0 && str.length() > maxLen)
                str = str.substring(0, maxLen) + "...[truncated]";
            return new MaskResult(str, false);
        }
    }

    private static String maskAndTruncateJson(Object obj, int maxLen, Collection<String> extraMaskKeys) {
        try {
            JsonNode tree = MAPPER.valueToTree(obj);
            AtomicBoolean wasMasked = new AtomicBoolean(false);
            maskNode(tree, extraMaskKeys, wasMasked);
            String json = MAPPER.writeValueAsString(tree);
            if (maxLen > 0 && json.length() > maxLen)
                return json.substring(0, maxLen) + "...[truncated]";
            return json;
        } catch (JsonProcessingException | IllegalArgumentException e) {
            String str = String.valueOf(obj);
            if (maxLen > 0 && str.length() > maxLen) {
                return str.substring(0, maxLen) + "...[truncated]";
            }
            return "\"" + str.replace("\"", "\\\"") + "\"";
        }
    }

    private static void maskNode(JsonNode node, Collection<String> extraMaskKeys, AtomicBoolean wasMasked) {
        if (node == null) return;
        if (node.isObject()) {
            ObjectNode objNode = (ObjectNode) node;
            for (Map.Entry<String, JsonNode> entry : objNode.properties()) {
                String key = entry.getKey();
                if (isSensitive(key, extraMaskKeys)) {
                    entry.setValue(new TextNode("***"));
                    wasMasked.set(true);
                } else {
                    maskNode(entry.getValue(), extraMaskKeys, wasMasked);
                }
            }
        } else if (node.isArray()) {
            ArrayNode arrNode = (ArrayNode) node;
            for (JsonNode item : arrNode) {
                maskNode(item, extraMaskKeys, wasMasked);
            }
        }
    }

    public static boolean isSensitive(String key, Collection<String> extraMaskKeys) {
        if (key == null) return false;
        String lower = key.toLowerCase().replace("_", "").replace("-", "");
        for (String mask : DEFAULT_MASK_KEYS) {
            if (lower.contains(mask.replace("-", ""))) return true;
        }
        if (extraMaskKeys != null) {
            for (String mask : extraMaskKeys) {
                if (lower.contains(mask.toLowerCase().replace("-", ""))) {
                    return true;
                }
            }
        }
        return false;
    }

    private record MaskResult(Object value, boolean wasMasked) {
    }
}
