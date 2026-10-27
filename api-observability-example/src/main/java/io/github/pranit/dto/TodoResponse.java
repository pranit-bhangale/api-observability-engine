package io.github.pranit.dto;

import io.github.pranit.model.TodoPriority;
import io.github.pranit.model.TodoStatus;

import java.time.LocalDateTime;

public record TodoResponse(
        Long id,
        String title,
        String description,
        TodoStatus status,
        TodoPriority priority,
        LocalDateTime dueDate,
        String assignedUserId,
        LocalDateTime completedAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        String workflowNotice
) {}
