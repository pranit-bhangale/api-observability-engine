package io.github.pranit;

import io.github.pranit.config.ObservabilityConfiguration;
import io.github.pranit.controller.AuthController;
import io.github.pranit.controller.ObserveApiController;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;

@SpringBootApplication
@ComponentScan(
        basePackages = "io.github.pranit",
        excludeFilters = @ComponentScan.Filter(
                type = FilterType.ASSIGNABLE_TYPE,
                classes = {
                        ObserveApiController.class,
                        AuthController.class,
                        ObservabilityConfiguration.class
                }
        )
)
public class TodoApplication {

    public static void main(String[] args) {
        SpringApplication.run(TodoApplication.class, args);
    }
}
