package io.github.pranit.service;

import io.github.pranit.audit.TodoAuditRecord;
import io.github.pranit.entity.Todo;
import io.github.pranit.repository.TodoAuditRepository;
import io.github.pranit.annotation.ActionOn;
import io.github.pranit.annotation.Observe;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditService {

    private final TodoAuditRepository auditRepository;

    public AuditService(TodoAuditRepository auditRepository) {
        this.auditRepository = auditRepository;
    }

    /**
     * Call 10 / Complete Call 9: Creates an in-memory audit record object.
     */
    @Observe(category = ActionOn.SERVICE, name = "AuditService.createAuditRecord",
            captureRequest = true, captureResponse = true)
    public TodoAuditRecord createAuditRecord(Todo todo, String action) {
        String details = String.format("Title: '%s' | Status: %s | Priority: %s | Assignee: %s",
                todo.getTitle(), todo.getStatus(), todo.getPriority(), todo.getAssignedUserId());

        return new TodoAuditRecord(todo.getId(), action, todo.getAssignedUserId(), details);
    }

    /**
     * Call 11 / Complete Call 10: Persists the audit record to the database.
     */
    @Transactional
    @Observe(category = ActionOn.SERVICE, name = "AuditService.saveAuditRecord",
            captureRequest = true, captureResponse = true)
    public TodoAuditRecord saveAuditRecord(TodoAuditRecord auditRecord) {
        return auditRepository.save(auditRecord);
    }
}
