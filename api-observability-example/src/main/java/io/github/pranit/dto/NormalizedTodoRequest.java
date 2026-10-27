package io.github.pranit.dto;

import io.github.pranit.model.TodoPriority;

import java.time.LocalDateTime;

public record NormalizedTodoRequest(
        String title,
        String description,
        TodoPriority requestedPriority,
        LocalDateTime requestedDueDate,
        String assignedUserId,
        LocalDateTime normalizedAt
) {}
