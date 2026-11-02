package io.github.pranit.repository;

import io.github.pranit.audit.TodoAuditRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TodoAuditRepository extends JpaRepository<TodoAuditRecord, Long> {

    List<TodoAuditRecord> findByTodoIdOrderByTimestampDesc(Long todoId);
}
