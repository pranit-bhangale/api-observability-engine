package io.github.pranit.service;

import io.github.pranit.dto.Assignee;
import io.github.pranit.dto.CreateTodoRequest;
import io.github.pranit.dto.NormalizedTodoRequest;
import io.github.pranit.entity.Todo;
import io.github.pranit.exception.BusinessValidationException;
import io.github.pranit.model.TodoPriority;
import io.github.pranit.model.TodoStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

class TodoValidationAndCalculationTest {

    private final TodoValidationService validationService = new TodoValidationService();
    private final UserAssignmentService userAssignmentService = new UserAssignmentService();
    private final TodoPriorityService priorityService = new TodoPriorityService();
    private final DeadlineService deadlineService = new DeadlineService();

    @Test
    @DisplayName("TodoValidationService correctly normalizes strings and provides default fallbacks")
    void testNormalizeRequest() {
        CreateTodoRequest request = new CreateTodoRequest(
                "  Clean Arch Task  ", "  Detailed description  ", null, null, "  "
        );
        NormalizedTodoRequest normalized = validationService.normalizeRequest(request);

        assertEquals("Clean Arch Task", normalized.title());
        assertEquals("Detailed description", normalized.description());
        assertEquals(TodoPriority.MEDIUM, normalized.requestedPriority());
        assertEquals("USR-DEFAULT", normalized.assignedUserId());
    }

    @Test
    @DisplayName("TodoValidationService throws exception when title is less than 3 characters")
    void testValidateCreateRequest_ShortTitle() {
        NormalizedTodoRequest normalized = new NormalizedTodoRequest(
                "ab", "desc", TodoPriority.LOW, null, "USR-101", LocalDateTime.now()
        );
        assertThrows(BusinessValidationException.class, () -> validationService.validateCreateRequest(normalized));
    }

    @Test
    @DisplayName("TodoValidationService throws exception when due date is in the past")
    void testValidateCreateRequest_PastDueDate() {
        NormalizedTodoRequest normalized = new NormalizedTodoRequest(
                "Valid Task", "desc", TodoPriority.LOW, LocalDateTime.now().minusDays(1), "USR-101", LocalDateTime.now()
        );
        assertThrows(BusinessValidationException.class, () -> validationService.validateCreateRequest(normalized));
    }

    @Test
    @DisplayName("UserAssignmentService resolves existing active users and rejects non-existent or inactive users")
    void testResolveAssignee() {
        Assignee alice = userAssignmentService.resolveAssignee("USR-101");
        assertNotNull(alice);
        assertEquals("Alice Johnson", alice.name());
        assertTrue(alice.active());

        // Inactive user
        assertThrows(BusinessValidationException.class, () -> userAssignmentService.resolveAssignee("USR-INACTIVE"));

        // Non-existent user
        assertThrows(BusinessValidationException.class, () -> userAssignmentService.resolveAssignee("USR-NON-EXISTENT"));
    }

    @Test
    @DisplayName("TodoPriorityService calculates HIGH priority when due within 24 hours")
    void testPriorityEscalation() {
        NormalizedTodoRequest urgent = new NormalizedTodoRequest(
                "Urgent task", "desc", TodoPriority.LOW, LocalDateTime.now().plusHours(12), "USR-101", LocalDateTime.now()
        );
        Assignee assignee = new Assignee("USR-101", "Alice", "Eng", true, 1);

        TodoPriority calculated = priorityService.calculatePriority(urgent, assignee);
        assertEquals(TodoPriority.HIGH, calculated);
    }

    @Test
    @DisplayName("DeadlineService calculates automated SLA deadline when not provided")
    void testDeadlineCalculation() {
        NormalizedTodoRequest req = new NormalizedTodoRequest(
                "Task", "desc", TodoPriority.HIGH, null, "USR-101", LocalDateTime.now()
        );
        LocalDateTime deadline = deadlineService.calculateDeadline(req, TodoPriority.HIGH);
        assertNotNull(deadline);
        assertTrue(deadline.isAfter(LocalDateTime.now()));
    }
}
