package io.github.pranit.service;

import io.github.pranit.dto.Assignee;
import io.github.pranit.dto.NormalizedTodoRequest;
import io.github.pranit.model.TodoPriority;
import io.github.pranit.annotation.ActionOn;
import io.github.pranit.annotation.Observe;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
public class TodoPriorityService {

    /**
     * Call 6: Calculates effective priority based on requested level and assignee workload.
     */
    @Observe(category = ActionOn.SERVICE, name = "TodoPriorityService.calculatePriority",
            captureRequest = true, captureResponse = true)
    public TodoPriority calculatePriority(NormalizedTodoRequest request, Assignee assignee) {
        // Rule 1: Explicit HIGH priority request is respected
        if (request.requestedPriority() == TodoPriority.HIGH) {
            return TodoPriority.HIGH;
        }

        // Rule 2: Escalation if due date is within 24 hours
        if (request.requestedDueDate() != null
                && request.requestedDueDate().isBefore(LocalDateTime.now().plusHours(24))) {
            return TodoPriority.HIGH;
        }

        // Rule 3: Escalation if assignee is heavily loaded
        if (assignee.currentWorkload() >= 5 && request.requestedPriority() == TodoPriority.LOW) {
            return TodoPriority.MEDIUM;
        }

        return request.requestedPriority() != null ? request.requestedPriority() : TodoPriority.MEDIUM;
    }
}
