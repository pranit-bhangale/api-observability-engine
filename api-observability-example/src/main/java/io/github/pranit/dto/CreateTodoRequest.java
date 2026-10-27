package io.github.pranit.dto;

import io.github.pranit.model.TodoPriority;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

public record CreateTodoRequest(
        @NotBlank(message = "Title must not be blank")
        @Size(min = 3, max = 200, message = "Title must be between 3 and 200 characters")
        String title,

        @Size(max = 1000, message = "Description must not exceed 1000 characters")
        String description,

        TodoPriority priority,

        LocalDateTime dueDate,

        String assignedUserId
) {}
