package io.github.pranit.dto;

import java.time.LocalDateTime;

public record NotificationPayload(
        Long todoId,
        String recipientId,
        String subject,
        String message,
        String channel,
        LocalDateTime preparedAt
) {}
