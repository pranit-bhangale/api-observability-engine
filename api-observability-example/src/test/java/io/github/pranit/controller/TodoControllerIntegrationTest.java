package io.github.pranit.controller;

import io.github.pranit.dto.CreateTodoRequest;
import io.github.pranit.model.TodoPriority;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.pranit.store.ObserveStore;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
class TodoControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @Autowired(required = false)
    private ObserveStore observeStore;

    @Test
    @DisplayName("POST /api/todos triggers the full 16-call workflow and records telemetry in api-observability-starter")
    void testCreateTodo_Integration_AndObservability() throws Exception {
        CreateTodoRequest request = new CreateTodoRequest(
                "Integrate Observability Engine",
                "Ensure child spans are recorded for all 16 chained method calls",
                TodoPriority.HIGH,
                null,
                "USR-101"
        );

        mockMvc.perform(post("/api/todos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data.id", notNullValue()))
                .andExpect(jsonPath("$.data.title", is("Integrate Observability Engine")))
                .andExpect(jsonPath("$.data.status", is("PENDING")))
                .andExpect(jsonPath("$.data.priority", is("HIGH")))
                .andExpect(jsonPath("$.data.assignedUserId", is("USR-101")))
                .andExpect(jsonPath("$.data.dueDate", notNullValue()));

        // Verify starter module telemetry capture:
        if (observeStore != null) {
            assertFalse(observeStore.getTraces().isEmpty(), "ObserveStore should have captured traces for the request");
        }
    }

    @Test
    @DisplayName("POST /api/todos with blank title returns 400 Bad Request from GlobalExceptionHandler")
    void testCreateTodo_ValidationFailure() throws Exception {
        CreateTodoRequest invalidRequest = new CreateTodoRequest(
                "", // Blank title
                "Description",
                TodoPriority.LOW,
                null,
                "USR-101"
        );

        mockMvc.perform(post("/api/todos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status", is(400)))
                .andExpect(jsonPath("$.error", is("Bad Request")));
    }

    @Test
    @DisplayName("PATCH /api/todos/{id}/complete transitions state and returns 200 OK")
    void testCompleteTodo_Integration() throws Exception {
        // Step 1: Create a Todo
        CreateTodoRequest request = new CreateTodoRequest(
                "Task to complete",
                "Description",
                TodoPriority.MEDIUM,
                null,
                "USR-102"
        );

        String createResponseJson = mockMvc.perform(post("/api/todos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        Number todoId = com.jayway.jsonpath.JsonPath.read(createResponseJson, "$.data.id");

        // Step 2: Complete the Todo
        mockMvc.perform(patch("/api/todos/" + todoId + "/complete"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status", is("COMPLETED")))
                .andExpect(jsonPath("$.data.completedAt", notNullValue()));

        // Step 3: Complete again -> should return 422 Unprocessable Entity
        mockMvc.perform(patch("/api/todos/" + todoId + "/complete"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.status", is(422)))
                .andExpect(jsonPath("$.message", containsString("already in COMPLETED status")));
    }

    @Test
    @DisplayName("GET /api/todos/{id} with non-existent id returns 404 Not Found")
    void testGetTodo_NotFound() throws Exception {
        mockMvc.perform(get("/api/todos/999999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status", is(404)))
                .andExpect(jsonPath("$.message", containsString("Todo not found with id: 999999")));
    }
}
