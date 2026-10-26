package io.github.pranit.writer;

import java.lang.reflect.Array;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Tiny dependency-free JSON writer.
 */
public final class JsonWriter {

    private static final int MAX_DEPTH = 32;

    private JsonWriter() {
        throw new UnsupportedOperationException("utility class");
    }

    public static String json(final Object... pairs) {
        if (pairs.length % 2 != 0) {
            throw new IllegalArgumentException("Pairs must be key-value alternations");
        }
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) {
            m.put(String.valueOf(pairs[i]), pairs[i + 1]);
        }
        return write(m);
    }

    public static String write(Object value) {
        StringBuilder sb = new StringBuilder(256);
        write(sb, value, 0);
        return sb.toString();
    }

    private static void write(StringBuilder sb, Object v, int depth) {
        if (depth > MAX_DEPTH) {
            quote(sb, "<max depth>");
            return;
        }
        switch (v) {
            case null -> sb.append("null");
            case Raw r -> sb.append(r.json());
            case Number n -> {
                String number = n.toString();
                try {
                    new java.math.BigDecimal(number);
                    sb.append(number);
                } catch (NumberFormatException e) {
                    sb.append("null");
                }
            }
            case Boolean b -> sb.append(b);
            case Map<?, ?> m -> {
                sb.append('{');
                boolean first = true;
                for (Map.Entry<?, ?> e : m.entrySet()) {
                    if (!first) sb.append(',');
                    first = false;
                    quote(sb, String.valueOf(e.getKey()));
                    sb.append(':');
                    write(sb, e.getValue(), depth + 1);
                }
                sb.append('}');
            }
            case Iterable<?> it -> {
                sb.append('[');
                boolean first = true;
                for (Object o : it) {
                    if (!first) sb.append(',');
                    first = false;
                    write(sb, o, depth + 1);
                }
                sb.append(']');
            }
            case Object[] arr -> {
                sb.append('[');
                for (int i = 0; i < arr.length; i++) {
                    if (i > 0) sb.append(',');
                    write(sb, arr[i], depth + 1);
                }
                sb.append(']');
            }
            default -> {
                if (v.getClass().isArray()) {
                    int len = Array.getLength(v);
                    sb.append('[');
                    for (int i = 0; i < len; i++) {
                        if (i > 0) sb.append(',');
                        write(sb, Array.get(v, i), depth + 1);
                    }
                    sb.append(']');
                } else {
                    quote(sb, v.toString());
                }
            }
        }
    }

    private static void quote(StringBuilder sb, String s) {
        sb.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    if (c < 0x20) {
                        sb.append("\\u00");
                        sb.append("0123456789abcdef".charAt((c >> 4) & 0xF));
                        sb.append("0123456789abcdef".charAt(c & 0xF));
                    } else {
                        sb.append(c);
                    }
                }
            }
        }
        sb.append('"');
    }

    public record Raw(String json) {
        public Raw {
            if (json == null) {
                throw new IllegalArgumentException("Raw JSON must not be null");
            }
        }
    }
}
