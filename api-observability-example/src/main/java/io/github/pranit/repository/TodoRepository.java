package io.github.pranit.repository;

import io.github.pranit.entity.Todo;
import io.github.pranit.model.TodoStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TodoRepository extends JpaRepository<Todo, Long> {

    List<Todo> findByStatus(TodoStatus status);

    List<Todo> findByAssignedUserId(String assignedUserId);

    Page<Todo> findAll(Pageable pageable);
}
