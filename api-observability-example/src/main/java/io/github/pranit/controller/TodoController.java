package io.github.pranit.controller;

import io.github.pranit.dto.ApiResponse;
import io.github.pranit.dto.CreateTodoRequest;
import io.github.pranit.dto.TodoResponse;
import io.github.pranit.dto.UpdateTodoRequest;
import io.github.pranit.service.TodoService;
import io.github.pranit.annotation.ActionOn;
import io.github.pranit.annotation.Observe;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/todos")
public class TodoController {

    private final TodoService todoService;

    public TodoController(TodoService todoService) {
        this.todoService = todoService;
    }

    /**
     * Call 1: HTTP Entrypoint for Deep-Chained Todo Creation.
     * Annotated with @Observe(category = ActionOn.CONTROLLER) to trigger deep child-span capture
     * of all internal Spring Bean method calls.
     */
    @PostMapping
    @Observe(category = ActionOn.CONTROLLER, name = "POST /api/todos",
            captureRequest = true, captureResponse = true)
    public ResponseEntity<ApiResponse<TodoResponse>> createTodo(@Valid @RequestBody CreateTodoRequest request) {
        ApiResponse<TodoResponse> response = todoService.createTodo(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Complete Workflow Call 1: HTTP Entrypoint for Completing a Todo.
     */
    @PatchMapping("/{id}/complete")
    @Observe(category = ActionOn.CONTROLLER, name = "PATCH /api/todos/{id}/complete",
            captureRequest = true, captureResponse = true)
    public ResponseEntity<ApiResponse<TodoResponse>> completeTodo(@PathVariable Long id) {
        ApiResponse<TodoResponse> response = todoService.completeTodo(id);
        return ResponseEntity.ok(response);
    }

    /**
     * Retrieves a single Todo by ID.
     */
    @GetMapping("/{id}")
    @Observe(category = ActionOn.CONTROLLER, name = "GET /api/todos/{id}",
            captureRequest = true, captureResponse = true)
    public ResponseEntity<ApiResponse<TodoResponse>> getTodoById(@PathVariable Long id) {
        ApiResponse<TodoResponse> response = todoService.getTodoById(id);
        return ResponseEntity.ok(response);
    }

    /**
     * Retrieves paginated list of Todos.
     */
    @GetMapping
    @Observe(category = ActionOn.CONTROLLER, name = "GET /api/todos",
            captureRequest = true, captureResponse = true)
    public ResponseEntity<Page<TodoResponse>> getTodos(
            @PageableDefault(size = 20, sort = "createdAt") Pageable pageable) {
        Page<TodoResponse> todos = todoService.getTodos(pageable);
        return ResponseEntity.ok(todos);
    }

    /**
     * Updates an existing Todo.
     */
    @PutMapping("/{id}")
    @Observe(category = ActionOn.CONTROLLER, name = "PUT /api/todos/{id}",
            captureRequest = true, captureResponse = true)
    public ResponseEntity<ApiResponse<TodoResponse>> updateTodo(
            @PathVariable Long id, @RequestBody UpdateTodoRequest request) {
        ApiResponse<TodoResponse> response = todoService.updateTodo(id, request);
        return ResponseEntity.ok(response);
    }
}
