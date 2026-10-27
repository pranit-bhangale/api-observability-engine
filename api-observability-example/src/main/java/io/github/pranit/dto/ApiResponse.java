package io.github.pranit.dto;

import java.time.LocalDateTime;

public record ApiResponse<T>(
        boolean success,
        String message,
        T data,
        LocalDateTime timestamp,
        String traceId
) {
    public static <T> ApiResponse<T> ok(T data, String message) {
        return new ApiResponse<>(true, message, data, LocalDateTime.now(), null);
    }

    public static <T> ApiResponse<T> ok(T data, String message, String traceId) {
        return new ApiResponse<>(true, message, data, LocalDateTime.now(), traceId);
    }

    public static <T> ApiResponse<T> created(T data, String message, String traceId) {
        return new ApiResponse<>(true, message, data, LocalDateTime.now(), traceId);
    }
}
