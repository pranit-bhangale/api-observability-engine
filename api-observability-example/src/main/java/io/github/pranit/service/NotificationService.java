package io.github.pranit.service;

import io.github.pranit.audit.TodoAuditRecord;
import io.github.pranit.dto.NotificationPayload;
import io.github.pranit.entity.Todo;
import io.github.pranit.annotation.ActionOn;
import io.github.pranit.annotation.Observe;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
public class NotificationService {

    /**
     * Call 12: Prepares a formatted notification payload from the persisted todo and audit record.
     */
    @Observe(category = ActionOn.SERVICE, name = "NotificationService.prepareNotification",
            captureRequest = true, captureResponse = true)
    public NotificationPayload prepareNotification(Todo todo, TodoAuditRecord savedAudit) {
        String subject = "Todo Created: " + todo.getTitle();
        String message = String.format("Todo #%d has been assigned to you. Priority: %s. Audit Ref: #%d",
                todo.getId(), todo.getPriority(), savedAudit.getId());

        return new NotificationPayload(
                todo.getId(),
                todo.getAssignedUserId(),
                subject,
                message,
                "IN_APP_DISPATCH",
                LocalDateTime.now()
        );
    }
}
