package io.github.pranit.service;

import io.github.pranit.audit.TodoAuditRecord;
import io.github.pranit.dto.NotificationPayload;
import io.github.pranit.entity.Todo;
import io.github.pranit.event.TodoCompletedEvent;
import io.github.pranit.event.TodoCreatedEvent;
import io.github.pranit.annotation.ActionOn;
import io.github.pranit.annotation.Observe;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

@Service
public class TodoEventService {

    private final ApplicationEventPublisher eventPublisher;

    public TodoEventService(ApplicationEventPublisher eventPublisher) {
        this.eventPublisher = eventPublisher;
    }

    /**
     * Call 13: Publishes a domain event for Todo creation.
     */
    @Observe(category = ActionOn.SERVICE, name = "TodoEventService.publishTodoCreatedEvent",
            captureRequest = true, captureResponse = true)
    public TodoCreatedEvent publishTodoCreatedEvent(Todo todo, NotificationPayload notification) {
        TodoCreatedEvent event = TodoCreatedEvent.of(todo, notification);
        eventPublisher.publishEvent(event);
        return event;
    }

    /**
     * Complete Workflow Call 11: Publishes a domain event for Todo completion.
     */
    @Observe(category = ActionOn.SERVICE, name = "TodoEventService.publishTodoCompletedEvent",
            captureRequest = true, captureResponse = true)
    public TodoCompletedEvent publishTodoCompletedEvent(Todo todo, TodoAuditRecord audit) {
        TodoCompletedEvent event = TodoCompletedEvent.of(todo, audit);
        eventPublisher.publishEvent(event);
        return event;
    }
}
