package io.github.pranit.exception;

public class TodoNotFoundException extends RuntimeException {

    private final Long todoId;

    public TodoNotFoundException(Long todoId) {
        super("Todo not found with id: " + todoId);
        this.todoId = todoId;
    }

    public Long getTodoId() {
        return todoId;
    }
}
