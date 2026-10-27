package io.github.pranit.service;

import io.github.pranit.dto.ApiResponse;
import io.github.pranit.dto.NotificationPayload;
import io.github.pranit.dto.TodoResponse;
import io.github.pranit.entity.Todo;
import io.github.pranit.annotation.ActionOn;
import io.github.pranit.annotation.Observe;
import org.springframework.stereotype.Service;

@Service
public class TodoResponseService {

    /**
     * Call 14 / Complete Call 12: Converts the saved Todo entity into a rich response DTO.
     */
    @Observe(category = ActionOn.SERVICE, name = "TodoResponseService.toResponse",
            captureRequest = true, captureResponse = true)
    public TodoResponse toResponse(Todo todo, NotificationPayload notification) {
        String notice = (notification != null)
                ? "Notification dispatched to " + notification.recipientId() + " via " + notification.channel()
                : "No notification dispatched";

        return new TodoResponse(
                todo.getId(),
                todo.getTitle(),
                todo.getDescription(),
                todo.getStatus(),
                todo.getPriority(),
                todo.getDueDate(),
                todo.getAssignedUserId(),
                todo.getCompletedAt(),
                todo.getCreatedAt(),
                todo.getUpdatedAt(),
                notice
        );
    }

    /**
     * Call 15 / Complete Call 13: Wraps the response DTO into the standardized ApiResponse envelope.
     */
    @Observe(category = ActionOn.SERVICE, name = "TodoResponseService.buildApiResponse",
            captureRequest = true, captureResponse = true)
    public ApiResponse<TodoResponse> buildApiResponse(TodoResponse response) {
        String message = "Todo operation completed successfully for ID #" + response.id();
        return ApiResponse.ok(response, message);
    }
}
