package io.github.pranit.service;

import io.github.pranit.dto.Assignee;
import io.github.pranit.exception.BusinessValidationException;
import io.github.pranit.annotation.ActionOn;
import io.github.pranit.annotation.Observe;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class UserAssignmentService {

    // Simulated user directory
    private static final Map<String, Assignee> DIRECTORY = Map.of(
            "USR-DEFAULT", new Assignee("USR-DEFAULT", "Unassigned Pool", "General", true, 0),
            "USR-101", new Assignee("USR-101", "Alice Johnson", "Engineering", true, 3),
            "USR-102", new Assignee("USR-102", "Bob Smith", "Platform Ops", true, 5),
            "USR-103", new Assignee("USR-103", "Carol White", "Product", true, 1),
            "USR-INACTIVE", new Assignee("USR-INACTIVE", "Dave Inactive", "QA", false, 0)
    );

    /**
     * Call 5: Resolves and validates the assigned user.
     */
    @Observe(category = ActionOn.SERVICE, name = "UserAssignmentService.resolveAssignee",
            captureRequest = true, captureResponse = true)
    public Assignee resolveAssignee(String assignedUserId) {
        if (assignedUserId == null || assignedUserId.isBlank()) {
            return DIRECTORY.get("USR-DEFAULT");
        }

        Assignee assignee = DIRECTORY.get(assignedUserId);
        if (assignee == null) {
            throw new BusinessValidationException("assignedUserId", "Assigned user '" + assignedUserId + "' does not exist in directory");
        }
        if (!assignee.active()) {
            throw new BusinessValidationException("assignedUserId", "Assigned user '" + assignedUserId + "' is currently inactive");
        }

        return assignee;
    }
}
