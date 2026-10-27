package io.github.pranit.service;

import io.github.pranit.audit.TodoAuditRecord;
import io.github.pranit.dto.*;
import io.github.pranit.entity.Todo;
import io.github.pranit.exception.BusinessValidationException;
import io.github.pranit.exception.TodoNotFoundException;
import io.github.pranit.model.TodoPriority;
import io.github.pranit.model.TodoStatus;
import io.github.pranit.repository.TodoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TodoServiceTest {

    @Mock
    private TodoRepository todoRepository;
    @Mock
    private TodoValidationService validationService;
    @Mock
    private UserAssignmentService userAssignmentService;
    @Mock
    private TodoPriorityService priorityService;
    @Mock
    private DeadlineService deadlineService;
    @Mock
    private AuditService auditService;
    @Mock
    private NotificationService notificationService;
    @Mock
    private TodoEventService eventService;
    @Mock
    private TodoResponseService responseService;

    private TodoService todoService;

    @BeforeEach
    void setUp() {
        todoService = new TodoService(
                todoRepository,
                validationService,
                userAssignmentService,
                priorityService,
                deadlineService,
                auditService,
                notificationService,
                eventService,
                responseService
        );
    }

    @Test
    @DisplayName("createTodo executes the full 15-step chain passing return values between methods")
    void testCreateTodo_DeepMethodChain_VerifiesReturnPassing() {
        // Arrange
        CreateTodoRequest request = new CreateTodoRequest(
                "Implement telemetry", "Deep chain testing", TodoPriority.HIGH, null, "USR-101"
        );
        NormalizedTodoRequest normalized = new NormalizedTodoRequest(
                "Implement telemetry", "Deep chain testing", TodoPriority.HIGH, null, "USR-101", LocalDateTime.now()
        );
        Assignee assignee = new Assignee("USR-101", "Alice Johnson", "Engineering", true, 2);
        LocalDateTime calculatedDeadline = LocalDateTime.now().plusDays(1);
        Todo savedTodo = new Todo("Implement telemetry", "Deep chain testing", TodoStatus.PENDING,
                TodoPriority.HIGH, calculatedDeadline, "USR-101");
        savedTodo.setId(42L);

        TodoAuditRecord auditRecord = new TodoAuditRecord(42L, "TODO_CREATED", "USR-101", "Details");
        auditRecord.setId(101L);
        NotificationPayload notification = new NotificationPayload(
                42L, "USR-101", "Todo Created", "Message", "IN_APP", LocalDateTime.now()
        );
        TodoResponse todoResponse = new TodoResponse(
                42L, "Implement telemetry", "Deep chain testing", TodoStatus.PENDING,
                TodoPriority.HIGH, calculatedDeadline, "USR-101", null,
                LocalDateTime.now(), LocalDateTime.now(), "Dispatched"
        );
        ApiResponse<TodoResponse> expectedApiResponse = ApiResponse.ok(todoResponse, "Success");

        // Mock return-value chain
        when(validationService.normalizeRequest(request)).thenReturn(normalized);
        doNothing().when(validationService).validateCreateRequest(normalized);
        when(userAssignmentService.resolveAssignee("USR-101")).thenReturn(assignee);
        when(priorityService.calculatePriority(normalized, assignee)).thenReturn(TodoPriority.HIGH);
        when(deadlineService.calculateDeadline(normalized, TodoPriority.HIGH)).thenReturn(calculatedDeadline);
        when(todoRepository.save(any(Todo.class))).thenReturn(savedTodo);
        when(auditService.createAuditRecord(savedTodo, "TODO_CREATED")).thenReturn(auditRecord);
        when(auditService.saveAuditRecord(auditRecord)).thenReturn(auditRecord);
        when(notificationService.prepareNotification(savedTodo, auditRecord)).thenReturn(notification);
        when(responseService.toResponse(savedTodo, notification)).thenReturn(todoResponse);
        when(responseService.buildApiResponse(todoResponse)).thenReturn(expectedApiResponse);

        // Act
        ApiResponse<TodoResponse> actualResponse = todoService.createTodo(request);

        // Assert & Verify explicit return-value passing across the chain
        assertNotNull(actualResponse);
        assertEquals(expectedApiResponse, actualResponse);

        // Verify Step 3: normalizeRequest called with raw request
        verify(validationService).normalizeRequest(request);

        // Verify Step 4: validateCreateRequest received the normalized return value
        verify(validationService).validateCreateRequest(normalized);

        // Verify Step 5: resolveAssignee received normalized's assignedUserId
        verify(userAssignmentService).resolveAssignee("USR-101");

        // Verify Step 6: calculatePriority received normalized and resolved assignee
        verify(priorityService).calculatePriority(normalized, assignee);

        // Verify Step 7: calculateDeadline received normalized and calculated priority
        verify(deadlineService).calculateDeadline(normalized, TodoPriority.HIGH);

        // Verify Step 8 & 9: save received Todo entity built with all previous artifacts
        ArgumentCaptor<Todo> todoCaptor = ArgumentCaptor.forClass(Todo.class);
        verify(todoRepository).save(todoCaptor.capture());
        assertEquals("Implement telemetry", todoCaptor.getValue().getTitle());
        assertEquals(TodoPriority.HIGH, todoCaptor.getValue().getPriority());
        assertEquals("USR-101", todoCaptor.getValue().getAssignedUserId());

        // Verify Step 10 & 11: audit record creation and persistence
        verify(auditService).createAuditRecord(savedTodo, "TODO_CREATED");
        verify(auditService).saveAuditRecord(auditRecord);

        // Verify Step 12: notification received saved entity and saved audit record
        verify(notificationService).prepareNotification(savedTodo, auditRecord);

        // Verify Step 13: domain event was published
        verify(eventService).publishTodoCreatedEvent(savedTodo, notification);

        // Verify Step 14 & 15: response conversion and API envelope wrapping
        verify(responseService).toResponse(savedTodo, notification);
        verify(responseService).buildApiResponse(todoResponse);
    }

    @Test
    @DisplayName("completeTodo executes chained workflow and transitions state to COMPLETED")
    void testCompleteTodo_Success() {
        Long todoId = 10L;
        Todo existingTodo = new Todo("Fix issue", "desc", TodoStatus.PENDING, TodoPriority.MEDIUM, null, "USR-101");
        existingTodo.setId(todoId);
        Todo completedTodo = new Todo("Fix issue", "desc", TodoStatus.COMPLETED, TodoPriority.MEDIUM, null, "USR-101");
        completedTodo.setId(todoId);

        TodoAuditRecord audit = new TodoAuditRecord(todoId, "TODO_COMPLETED", "USR-101", "Completed");
        audit.setId(201L);
        TodoResponse responseDto = new TodoResponse(todoId, "Fix issue", "desc", TodoStatus.COMPLETED,
                TodoPriority.MEDIUM, null, "USR-101", LocalDateTime.now(), LocalDateTime.now(), LocalDateTime.now(), "No notification");
        ApiResponse<TodoResponse> expectedResponse = ApiResponse.ok(responseDto, "Completed");

        when(todoRepository.findById(todoId)).thenReturn(Optional.of(existingTodo));
        when(validationService.validateExists(Optional.of(existingTodo), todoId)).thenReturn(existingTodo);
        doNothing().when(validationService).validateCurrentStatus(existingTodo);
        when(validationService.checkCompletionEligibility(existingTodo)).thenReturn(true);
        when(todoRepository.save(any(Todo.class))).thenReturn(completedTodo);
        when(auditService.createAuditRecord(completedTodo, "TODO_COMPLETED")).thenReturn(audit);
        when(auditService.saveAuditRecord(audit)).thenReturn(audit);
        when(responseService.toResponse(completedTodo, null)).thenReturn(responseDto);
        when(responseService.buildApiResponse(responseDto)).thenReturn(expectedResponse);

        ApiResponse<TodoResponse> result = todoService.completeTodo(todoId);

        assertNotNull(result);
        assertEquals(expectedResponse, result);
        verify(eventService).publishTodoCompletedEvent(completedTodo, audit);
    }

    @Test
    @DisplayName("completeTodo throws TodoNotFoundException when entity does not exist")
    void testCompleteTodo_NotFound() {
        Long missingId = 999L;
        when(todoRepository.findById(missingId)).thenReturn(Optional.empty());
        when(validationService.validateExists(Optional.empty(), missingId)).thenThrow(new TodoNotFoundException(missingId));

        assertThrows(TodoNotFoundException.class, () -> todoService.completeTodo(missingId));
        verify(todoRepository, never()).save(any());
    }

    @Test
    @DisplayName("completeTodo throws BusinessValidationException when already completed")
    void testCompleteTodo_AlreadyCompleted() {
        Long todoId = 5L;
        Todo completedTodo = new Todo("Task", "desc", TodoStatus.COMPLETED, TodoPriority.LOW, null, "USR-101");
        completedTodo.setId(todoId);

        when(todoRepository.findById(todoId)).thenReturn(Optional.of(completedTodo));
        when(validationService.validateExists(Optional.of(completedTodo), todoId)).thenReturn(completedTodo);
        doThrow(new BusinessValidationException("status", "Already completed"))
                .when(validationService).validateCurrentStatus(completedTodo);

        assertThrows(BusinessValidationException.class, () -> todoService.completeTodo(todoId));
        verify(todoRepository, never()).save(any());
    }
}
