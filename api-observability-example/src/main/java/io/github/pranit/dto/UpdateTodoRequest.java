package io.github.pranit.dto;

import io.github.pranit.model.TodoPriority;
import io.github.pranit.model.TodoStatus;

import java.time.LocalDateTime;

public record UpdateTodoRequest(
        String title,
        String description,
        TodoStatus status,
        TodoPriority priority,
        LocalDateTime dueDate,
        String assignedUserId
) {}
