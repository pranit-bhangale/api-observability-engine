package io.github.pranit.annotation;

import org.springframework.core.annotation.AliasFor;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a method or class for observation: sends the call to the live Observe dashboard.
 * <p>
 * Use {@link ActionOn#AUTO} to infer the category, or explicitly set
 * {@link ActionOn#CONTROLLER}, {@link ActionOn#SERVICE}, etc.
 * </p>
 */
@Documented
@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
public @interface Observe {

    /**
     * Category of the observed call. See {@link ActionOn} for options.
     * Defaults to {@link ActionOn#AUTO}.
     */
    ActionOn category() default ActionOn.AUTO;

    /**
     * Alias for {@link #name()}. Name or operation name on the UI.
     */
    @AliasFor("name")
    String value() default "";

    /**
     * Display name on the UI. Defaults to "{@code simpleClassName.methodName}".
     * If blank, {@link #value()} or the default name composed from the target class
     * and method name is used.
     */
    @AliasFor("value")
    String name() default "";

    /**
     * Include method request arguments in the observed data (inputArgs).
     * Defaults to {@code false}.
     */
    boolean captureRequest() default false;

    /**
     * Include method return / response value in the observed data (outputArgs).
     * Defaults to {@code false}.
     */
    boolean captureResponse() default false;

    /**
     * Maximum characters kept per argument or return value.
     * Set to {@code 0} for unlimited length.
     * Default is {@code 500}.
     */
    int maxLen() default 500;
}
