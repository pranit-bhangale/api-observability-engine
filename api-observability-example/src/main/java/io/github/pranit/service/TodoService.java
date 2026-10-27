package io.github.pranit.service;

import io.github.pranit.audit.TodoAuditRecord;
import io.github.pranit.dto.*;
import io.github.pranit.entity.Todo;
import io.github.pranit.model.TodoPriority;
import io.github.pranit.model.TodoStatus;
import io.github.pranit.repository.TodoRepository;
import io.github.pranit.annotation.ActionOn;
import io.github.pranit.annotation.Observe;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
public class TodoService {

    private final TodoRepository todoRepository;
    private final TodoValidationService validationService;
    private final UserAssignmentService userAssignmentService;
    private final TodoPriorityService priorityService;
    private final DeadlineService deadlineService;
    private final AuditService auditService;
    private final NotificationService notificationService;
    private final TodoEventService eventService;
    private final TodoResponseService responseService;

    public TodoService(
            TodoRepository todoRepository,
            TodoValidationService validationService,
            UserAssignmentService userAssignmentService,
            TodoPriorityService priorityService,
            DeadlineService deadlineService,
            AuditService auditService,
            NotificationService notificationService,
            TodoEventService eventService,
            TodoResponseService responseService) {
        this.todoRepository = todoRepository;
        this.validationService = validationService;
        this.userAssignmentService = userAssignmentService;
        this.priorityService = priorityService;
        this.deadlineService = deadlineService;
        this.auditService = auditService;
        this.notificationService = notificationService;
        this.eventService = eventService;
        this.responseService = responseService;
    }

    /**
     * Primary Workflow: Deep Chained Execution for Todo Creation (Calls 2 through 15).
     */
    @Transactional
    @Observe(category = ActionOn.SERVICE, name = "TodoService.createTodo",
            captureRequest = true, captureResponse = true)
    public ApiResponse<TodoResponse> createTodo(CreateTodoRequest request) {

        // Call 3: Normalize request strings and assign defaults
        NormalizedTodoRequest normalized = validationService.normalizeRequest(request);

        // Call 4: Validate business constraints on normalized input
        validationService.validateCreateRequest(normalized);

        // Call 5: Resolve and validate assignee from user directory
        Assignee assignee = userAssignmentService.resolveAssignee(normalized.assignedUserId());

        // Call 6: Calculate effective priority using request data & assignee workload
        TodoPriority priority = priorityService.calculatePriority(normalized, assignee);

        // Call 7: Determine or validate effective SLA deadline
        LocalDateTime deadline = deadlineService.calculateDeadline(normalized, priority);

        // Call 8: Construct entity using results of previous 5 method calls
        Todo todo = buildTodo(normalized, priority, deadline, assignee);

        // Call 9: Persist Todo entity to database
        Todo savedTodo = todoRepository.save(todo);

        // Call 10: Create audit record model using persisted entity
        TodoAuditRecord audit = auditService.createAuditRecord(savedTodo, "TODO_CREATED");

        // Call 11: Persist audit record to database
        TodoAuditRecord savedAudit = auditService.saveAuditRecord(audit);

        // Call 12: Prepare notification payload using saved entity and audit ref
        NotificationPayload notification = notificationService.prepareNotification(savedTodo, savedAudit);

        // Call 13: Publish Spring application domain event
        eventService.publishTodoCreatedEvent(savedTodo, notification);

        // Call 14: Transform persisted entity and notification info to response DTO
        TodoResponse todoResponse = responseService.toResponse(savedTodo, notification);

        // Call 15: Wrap response DTO into standardized API envelope
        return responseService.buildApiResponse(todoResponse);
    }

    /**
     * Call 8: Builds a new Todo entity from upstream workflow artifacts.
     */
    @Observe(category = ActionOn.SERVICE, name = "TodoService.buildTodo",
            captureRequest = true, captureResponse = true)
    public Todo buildTodo(
            NormalizedTodoRequest normalized,
            TodoPriority priority,
            LocalDateTime deadline,
            Assignee assignee) {
        return new Todo(
                normalized.title(),
                normalized.description(),
                TodoStatus.PENDING,
                priority,
                deadline,
                assignee.userId()
        );
    }

    /**
     * Secondary Workflow: Deep Chained Execution for Completing a Todo (13 Method Calls).
     */
    @Transactional
    @Observe(category = ActionOn.SERVICE, name = "TodoService.completeTodo",
            captureRequest = true, captureResponse = true)
    public ApiResponse<TodoResponse> completeTodo(Long id) {

        // Complete Call 3: Lookup Todo
        Optional<Todo> optionalTodo = lookupTodo(id);

        // Complete Call 4: Validate entity exists
        Todo todo = validationService.validateExists(optionalTodo, id);

        // Complete Call 5: Validate current status is not already completed
        validationService.validateCurrentStatus(todo);

        // Complete Call 6: Check completion business eligibility
        validationService.checkCompletionEligibility(todo);

        // Complete Call 7: Apply state transition
        Todo completedTodo = applyCompletionState(todo);

        // Complete Call 8: Persist updated state
        Todo savedTodo = todoRepository.save(completedTodo);

        // Complete Call 9: Create completion audit record
        TodoAuditRecord audit = auditService.createAuditRecord(savedTodo, "TODO_COMPLETED");

        // Complete Call 10: Persist audit record
        TodoAuditRecord savedAudit = auditService.saveAuditRecord(audit);

        // Complete Call 11: Publish completion domain event
        eventService.publishTodoCompletedEvent(savedTodo, savedAudit);

        // Complete Call 12: Transform entity to response DTO
        TodoResponse todoResponse = responseService.toResponse(savedTodo, null);

        // Complete Call 13: Build API response
        return responseService.buildApiResponse(todoResponse);
    }

    /**
     * Complete Call 3: Looks up Todo by ID.
     */
    @Observe(category = ActionOn.SERVICE, name = "TodoService.lookupTodo",
            captureRequest = true, captureResponse = true)
    public Optional<Todo> lookupTodo(Long id) {
        return todoRepository.findById(id);
    }

    /**
     * Complete Call 7: Updates Todo status to COMPLETED and sets timestamp.
     */
    @Observe(category = ActionOn.SERVICE, name = "TodoService.applyCompletionState",
            captureRequest = true, captureResponse = true)
    public Todo applyCompletionState(Todo todo) {
        todo.setStatus(TodoStatus.COMPLETED);
        todo.setCompletedAt(LocalDateTime.now());
        return todo;
    }

    @Transactional(readOnly = true)
    @Observe(category = ActionOn.SERVICE, name = "TodoService.getTodoById",
            captureRequest = true, captureResponse = true)
    public ApiResponse<TodoResponse> getTodoById(Long id) {
        Optional<Todo> optionalTodo = lookupTodo(id);
        Todo todo = validationService.validateExists(optionalTodo, id);
        TodoResponse response = responseService.toResponse(todo, null);
        return responseService.buildApiResponse(response);
    }

    @Transactional(readOnly = true)
    @Observe(category = ActionOn.SERVICE, name = "TodoService.getTodos",
            captureRequest = true, captureResponse = true)
    public Page<TodoResponse> getTodos(Pageable pageable) {
        return todoRepository.findAll(pageable)
                .map(t -> responseService.toResponse(t, null));
    }

    @Transactional
    @Observe(category = ActionOn.SERVICE, name = "TodoService.updateTodo",
            captureRequest = true, captureResponse = true)
    public ApiResponse<TodoResponse> updateTodo(Long id, UpdateTodoRequest request) {
        Optional<Todo> optionalTodo = lookupTodo(id);
        Todo todo = validationService.validateExists(optionalTodo, id);

        if (request.title() != null && !request.title().isBlank()) {
            todo.setTitle(request.title().trim());
        }
        if (request.description() != null) {
            todo.setDescription(request.description().trim());
        }
        if (request.status() != null) {
            todo.setStatus(request.status());
        }
        if (request.priority() != null) {
            todo.setPriority(request.priority());
        }
        if (request.dueDate() != null) {
            todo.setDueDate(request.dueDate());
        }
        if (request.assignedUserId() != null) {
            Assignee assignee = userAssignmentService.resolveAssignee(request.assignedUserId());
            todo.setAssignedUserId(assignee.userId());
        }

        Todo saved = todoRepository.save(todo);
        TodoAuditRecord audit = auditService.createAuditRecord(saved, "TODO_UPDATED");
        auditService.saveAuditRecord(audit);

        TodoResponse response = responseService.toResponse(saved, null);
        return responseService.buildApiResponse(response);
    }
}
