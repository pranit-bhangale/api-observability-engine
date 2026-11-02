package io.github.pranit.dto;

public record Assignee(
        String userId,
        String name,
        String department,
        boolean active,
        int currentWorkload
) {}
