package io.github.pranit.service;

import io.github.pranit.dto.NormalizedTodoRequest;
import io.github.pranit.model.TodoPriority;
import io.github.pranit.annotation.ActionOn;
import io.github.pranit.annotation.Observe;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
public class DeadlineService {

    /**
     * Call 7: Calculates or confirms the effective deadline based on priority.
     */
    @Observe(category = ActionOn.SERVICE, name = "DeadlineService.calculateDeadline",
            captureRequest = true, captureResponse = true)
    public LocalDateTime calculateDeadline(NormalizedTodoRequest request, TodoPriority priority) {
        if (request.requestedDueDate() != null) {
            return request.requestedDueDate();
        }

        // Auto-assign SLA deadline based on priority
        LocalDateTime now = LocalDateTime.now();
        return switch (priority) {
            case HIGH -> now.plusDays(1).withHour(18).withMinute(0).withSecond(0);
            case MEDIUM -> now.plusDays(3).withHour(18).withMinute(0).withSecond(0);
            case LOW -> now.plusDays(7).withHour(18).withMinute(0).withSecond(0);
        };
    }
}
