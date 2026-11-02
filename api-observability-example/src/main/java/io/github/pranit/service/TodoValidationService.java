package io.github.pranit.service;

import io.github.pranit.dto.CreateTodoRequest;
import io.github.pranit.dto.NormalizedTodoRequest;
import io.github.pranit.entity.Todo;
import io.github.pranit.exception.BusinessValidationException;
import io.github.pranit.exception.TodoNotFoundException;
import io.github.pranit.model.TodoPriority;
import io.github.pranit.model.TodoStatus;
import io.github.pranit.annotation.ActionOn;
import io.github.pranit.annotation.Observe;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
public class TodoValidationService {

    /**
     * Call 3: Normalizes the raw incoming request (trims strings, provides fallback defaults).
     */
    @Observe(category = ActionOn.SERVICE, name = "TodoValidationService.normalizeRequest",
            captureRequest = true, captureResponse = true)
    public NormalizedTodoRequest normalizeRequest(CreateTodoRequest request) {
        String cleanTitle = request.title() != null ? request.title().trim() : "";
        String cleanDesc = request.description() != null ? request.description().trim() : "";
        TodoPriority cleanPriority = request.priority() != null ? request.priority() : TodoPriority.MEDIUM;
        String cleanAssignee = (request.assignedUserId() != null && !request.assignedUserId().isBlank())
                ? request.assignedUserId().trim() : "USR-DEFAULT";

        return new NormalizedTodoRequest(
                cleanTitle,
                cleanDesc,
                cleanPriority,
                request.dueDate(),
                cleanAssignee,
                LocalDateTime.now()
        );
    }

    /**
     * Call 4: Validates business rules against the normalized request.
     */
    @Observe(category = ActionOn.SERVICE, name = "TodoValidationService.validateCreateRequest",
            captureRequest = true, captureResponse = true)
    public void validateCreateRequest(NormalizedTodoRequest normalized) {
        if (normalized.title().length() < 3) {
            throw new BusinessValidationException("title", "Todo title must have at least 3 characters after trimming");
        }
        if (normalized.requestedDueDate() != null && normalized.requestedDueDate().isBefore(LocalDateTime.now())) {
            throw new BusinessValidationException("dueDate", "Due date cannot be set in the past");
        }
    }

    /**
     * Complete Workflow Call: Validates existence of an entity from an Optional lookup.
     */
    @Observe(category = ActionOn.SERVICE, name = "TodoValidationService.validateExists",
            captureRequest = true, captureResponse = true)
    public Todo validateExists(Optional<Todo> optionalTodo, Long id) {
        return optionalTodo.orElseThrow(() -> new TodoNotFoundException(id));
    }

    /**
     * Complete Workflow Call: Validates current status transition eligibility.
     */
    @Observe(category = ActionOn.SERVICE, name = "TodoValidationService.validateCurrentStatus",
            captureRequest = true, captureResponse = true)
    public void validateCurrentStatus(Todo todo) {
        if (todo.getStatus() == TodoStatus.COMPLETED) {
            throw new BusinessValidationException("status", "Todo #" + todo.getId() + " is already in COMPLETED status");
        }
    }

    /**
     * Complete Workflow Call: Validates business readiness for completion.
     */
    @Observe(category = ActionOn.SERVICE, name = "TodoValidationService.checkCompletionEligibility",
            captureRequest = true, captureResponse = true)
    public boolean checkCompletionEligibility(Todo todo) {
        // Business rule: Todos must have an assigned user to be completed
        if (todo.getAssignedUserId() == null || todo.getAssignedUserId().isBlank()) {
            throw new BusinessValidationException("assignedUserId", "Cannot complete a todo that has no assigned user");
        }
        return true;
    }
}
