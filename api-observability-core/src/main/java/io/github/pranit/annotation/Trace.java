package io.github.pranit.annotation;

import org.springframework.core.annotation.AliasFor;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a method or class for tracing: writes one JSON line per trace to the daily log file.
 * <p>
 * Use {@link ActionOn#AUTO} to infer the category from your Spring stereotype,
 * or explicitly set {@link ActionOn#CONTROLLER}, {@link ActionOn#SERVICE}, etc.
 * </p>
 */
@Documented
@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
public @interface Trace {

    /**
     * Category of the traced call. Determines capture scope:
     * {@link ActionOn#AUTO} (infer from stereotype),
     * {@link ActionOn#CONTROLLER} (deep capture),
     * {@link ActionOn#SERVICE} (method only),
     * {@link ActionOn#REPOSITORY} (method only),
     * {@link ActionOn#LLM} (LLM API call).
     */
    ActionOn category() default ActionOn.AUTO;

    /**
     * Alias for {@link #name()}. Name of the traced call (e.g. "create-order").
     */
    @AliasFor("name")
    String value() default "";

    /**
     * Name of the traced call.
     */
    @AliasFor("value")
    String name() default "";

    /**
     * Also emit a log line (logger "tracing.entry") when the method is entered.
     */
    boolean logEntry() default false;

    /**
     * Capture method request arguments (inputArgs).
     * Defaults to {@code false}.
     */
    boolean captureRequest() default false;

    /**
     * Capture method return / response value (outputArgs).
     * Defaults to {@code false}.
     */
    boolean captureResponse() default false;

    /**
     * Maximum characters kept per argument or return value.
     * Set to {@code 0} for unlimited length.
     * Default is {@code 200}.
     */
    int maxLen() default 200;
}
