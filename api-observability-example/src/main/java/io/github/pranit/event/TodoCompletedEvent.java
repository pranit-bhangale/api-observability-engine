package io.github.pranit.event;

import io.github.pranit.audit.TodoAuditRecord;
import io.github.pranit.entity.Todo;

import java.time.LocalDateTime;

public record TodoCompletedEvent(
        Long todoId,
        String title,
        LocalDateTime completedAt,
        Long auditRecordId,
        LocalDateTime timestamp
) {
    public static TodoCompletedEvent of(Todo todo, TodoAuditRecord audit) {
        return new TodoCompletedEvent(
                todo.getId(),
                todo.getTitle(),
                todo.getCompletedAt(),
                audit != null ? audit.getId() : null,
                LocalDateTime.now()
        );
    }
}
