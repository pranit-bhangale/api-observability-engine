package io.github.pranit.event;

import io.github.pranit.dto.NotificationPayload;
import io.github.pranit.entity.Todo;

import java.time.LocalDateTime;

public record TodoCreatedEvent(
        Long todoId,
        String title,
        String assignedUserId,
        NotificationPayload notification,
        LocalDateTime timestamp
) {
    public static TodoCreatedEvent of(Todo todo, NotificationPayload notification) {
        return new TodoCreatedEvent(
                todo.getId(),
                todo.getTitle(),
                todo.getAssignedUserId(),
                notification,
                LocalDateTime.now()
        );
    }
}
