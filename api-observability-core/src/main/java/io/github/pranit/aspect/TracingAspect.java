package io.github.pranit.aspect;

import io.github.pranit.annotation.ActionOn;
import io.github.pranit.annotation.Observe;
import io.github.pranit.annotation.Trace;
import io.github.pranit.capture.ValueCapture;
import io.github.pranit.model.Span;
import io.github.pranit.model.TraceContext;
import io.github.pranit.model.TraceRecord;
import io.github.pranit.store.ObserveStore;
import io.github.pranit.writer.TraceFileWriter;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.aop.support.AopUtils;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.stereotype.Controller;
import org.springframework.stereotype.Repository;
import org.springframework.stereotype.Service;
import org.springframework.util.ClassUtils;
import org.springframework.web.bind.annotation.RestController;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Spring AOP Aspect that intercepts methods annotated with {@link Trace} or {@link Observe},
 * capturing trace execution spans and publishing completed records.
 * Supports both JDK Dynamic Proxies and CGLIB Proxies with high-performance metadata caching.
 */
@Aspect
public class TracingAspect {

    private final ObserveStore observeStore;
    private final TraceFileWriter traceFileWriter;
    private final List<String> maskKeys;

    private final ConcurrentHashMap<Method, MethodMeta> metaCache = new ConcurrentHashMap<>();

    private record MethodMeta(
            ActionOn category,
            String name,
            boolean isTraced,
            boolean isObserved,
            boolean captureRequest,
            boolean captureResponse,
            int maxLen,
            boolean hasAnnotation
    ) {
    }

    public TracingAspect(ObserveStore observeStore, TraceFileWriter traceFileWriter) {
        this(observeStore, traceFileWriter, List.of());
    }

    public TracingAspect(ObserveStore observeStore, TraceFileWriter traceFileWriter, List<String> maskKeys) {
        this.observeStore = observeStore;
        this.traceFileWriter = traceFileWriter;
        this.maskKeys = maskKeys != null ? maskKeys : List.of();
    }

    @Pointcut("@annotation(io.github.pranit.annotation.Trace) "
            + "|| @within(io.github.pranit.annotation.Trace) "
            + "|| execution(@io.github.pranit.annotation.Trace * *(..)) "
            + "|| execution(* (@io.github.pranit.annotation.Trace *).*(..))")
    public void traceAnnotated() {
    }

    @Pointcut("@annotation(io.github.pranit.annotation.Observe) "
            + "|| @within(io.github.pranit.annotation.Observe) "
            + "|| execution(@io.github.pranit.annotation.Observe * *(..)) "
            + "|| execution(* (@io.github.pranit.annotation.Observe *).*(..))")
    public void observeAnnotated() {
    }

    @Pointcut("(within(@org.springframework.stereotype.Service *) "
            + "|| within(@org.springframework.stereotype.Repository *) "
            + "|| within(@org.springframework.stereotype.Controller *) "
            + "|| within(@org.springframework.web.bind.annotation.RestController *)) "
            + "&& !within(jakarta.servlet.Filter+) "
            + "&& !within(org.springframework.web.filter.GenericFilterBean+) "
            + "&& !within(org.springframework.web.servlet.HandlerInterceptor+)")
    public void springBeans() {
    }

    @Around("(traceAnnotated() || observeAnnotated() || springBeans()) "
            + "&& execution(* *(..)) "
            + "&& !within(io.github.pranit.aspect..*) "
            + "&& !within(io.github.pranit.capture..*) "
            + "&& !within(io.github.pranit.store..*) "
            + "&& !within(io.github.pranit.writer..*) "
            + "&& !within(io.github.pranit.security..*) "
            + "&& !within(io.github.pranit.config..*) "
            + "&& !within(io.github.pranit.controller..*) "
            + "&& !within(io.github.pranit.discovery..*)")
    public Object around(ProceedingJoinPoint pjp) throws Throwable {
        MethodSignature sig = (MethodSignature) pjp.getSignature();
        Method method = sig.getMethod();
        Class<?> rawClass = pjp.getTarget() != null
                ? AopUtils.getTargetClass(pjp.getTarget()) : sig.getDeclaringType();
        final Class<?> targetClass = ClassUtils.getUserClass(rawClass);

        // Avoid self-interception on internal observability infrastructure
        String targetName = targetClass.getName();
        if (targetName.startsWith("io.github.pranit.aspect.")
                || targetName.startsWith("io.github.pranit.store.")
                || targetName.startsWith("io.github.pranit.writer.")
                || targetName.startsWith("io.github.pranit.capture.")
                || targetName.startsWith("io.github.pranit.security.")
                || targetName.startsWith("io.github.pranit.config.")
                || targetName.startsWith("io.github.pranit.controller.")
                || targetName.startsWith("io.github.pranit.discovery.")) {
            return pjp.proceed();
        }

        Method specificMethod = AopUtils.getMostSpecificMethod(method, targetClass);
        MethodMeta meta = metaCache.computeIfAbsent(specificMethod, m -> resolveMeta(method, m, targetClass));
        TraceContext currentCtx = TraceContext.current();

        // If neither annotation is present and no active deep trace exists, pass through
        if (!meta.hasAnnotation) {
            if (currentCtx == null || !currentCtx.deep) return pjp.proceed();
        }

        // Handle root span
        if (currentCtx == null) {
            return handleRootSpan(pjp, sig, specificMethod, targetClass, meta);
        } else {
            // Child spans are only recorded if deep tracing is enabled.
            if (!currentCtx.deep) return pjp.proceed();
            return handleChildSpan(pjp, sig, specificMethod, targetClass, meta, currentCtx);
        }
    }

    private MethodMeta resolveMeta(Method method, Method specificMethod, Class<?> targetClass) {
        Trace traceAnn = findAnnotation(method, specificMethod, targetClass, Trace.class);
        Observe observeAnn = findAnnotation(method, specificMethod, targetClass, Observe.class);

        ActionOn category = resolveCategory(traceAnn, observeAnn, targetClass);
        String name = resolveName(traceAnn, observeAnn, targetClass, specificMethod);
        boolean isTraced = traceAnn != null;
        boolean isObserved = observeAnn != null;
        boolean captureReq = isCaptureRequest(observeAnn, traceAnn);
        boolean captureResp = isCaptureResponse(observeAnn, traceAnn);

        int maxLen = 500;
        if (observeAnn != null) maxLen = observeAnn.maxLen();
        else if (traceAnn != null) maxLen = traceAnn.maxLen();

        boolean hasAnnotation = (traceAnn != null || observeAnn != null);
        return new MethodMeta(category, name, isTraced, isObserved, captureReq, captureResp, maxLen, hasAnnotation);
    }

    private Object handleRootSpan(
            ProceedingJoinPoint pjp, MethodSignature sig, Method specificMethod,
            Class<?> targetClass, MethodMeta meta) throws Throwable {

        ActionOn category = meta.category();
        String name = meta.name();
        boolean trace = meta.isTraced();
        boolean observe = meta.isObserved();
        boolean captureArgs = meta.captureRequest();
        boolean captureReturn = meta.captureResponse();
        int maxLen = meta.maxLen();

        TraceContext ctx = new TraceContext(trace, observe, category.isDeep(), captureArgs, captureReturn, maxLen, 2000);
        TraceContext.bind(ctx);
        Span root = ctx.span(category, name, targetClass.getName(), specificMethod.getName());
        String[] paramNames = sig.getParameterNames();

        if (captureArgs) {
            root.args = ValueCapture.captureArgs(specificMethod, paramNames, pjp.getArgs(), maxLen, maskKeys);
            root.inputArgs = ValueCapture.captureInputDetails(specificMethod, paramNames, pjp.getArgs(), maxLen, maskKeys);
        } else {
            root.args = null;
            root.inputArgs = null;
        }

        Object result;
        try {
            result = pjp.proceed();
            if (captureReturn) {
                root.result = ValueCapture.captureResult(result, maxLen, maskKeys);
                root.outputArgs = ValueCapture.captureOutputDetails(specificMethod, result, maxLen, maskKeys);
            } else {
                root.result = null;
                root.outputArgs = null;
            }
            return result;
        } catch (Throwable t) {
            root.status = "ERROR";
            root.error = t.getClass().getSimpleName() + (t.getMessage() != null ? ": " + t.getMessage() : "");
            root.errorMessage = t.getMessage() != null ? t.getMessage() : t.getClass().getSimpleName();
            root.errorDetail = formatErrorDetail(t);
            throw t;
        } finally {
            ctx.close(root);
            TraceRecord record = new TraceRecord(ctx);
            TraceContext.unbind();
            if (ctx.observe && observeStore != null) observeStore.add(record);
            if (ctx.trace && traceFileWriter != null) traceFileWriter.write(record);
        }
    }

    private Object handleChildSpan(
            ProceedingJoinPoint pjp, MethodSignature sig,
            Method specificMethod, Class<?> targetClass,
            MethodMeta meta, TraceContext ctx) throws Throwable {

        if (ctx.full()) {
            ctx.markDropped();
            return pjp.proceed();
        }

        ActionOn category = meta.category();
        String name = meta.name();

        boolean childCaptureArgs;
        boolean childCaptureReturn;
        if (meta.hasAnnotation()) {
            childCaptureArgs = meta.captureRequest();
            childCaptureReturn = meta.captureResponse();
        } else {
            childCaptureArgs = ctx.captureArgs;
            childCaptureReturn = ctx.captureReturn;
        }

        Span span = ctx.span(category, name, targetClass.getName(), specificMethod.getName());
        String[] paramNames = sig.getParameterNames();

        if (childCaptureArgs) {
            span.args = ValueCapture.captureArgs(specificMethod, paramNames, pjp.getArgs(), ctx.maxLen, maskKeys);
            span.inputArgs = ValueCapture.captureInputDetails(specificMethod, paramNames, pjp.getArgs(), ctx.maxLen, maskKeys);
        } else {
            span.args = null;
            span.inputArgs = null;
        }

        Object result;
        try {
            result = pjp.proceed();
            if (childCaptureReturn) {
                span.result = ValueCapture.captureResult(result, ctx.maxLen, maskKeys);
                span.outputArgs = ValueCapture.captureOutputDetails(specificMethod, result, ctx.maxLen, maskKeys);
            } else {
                span.result = null;
                span.outputArgs = null;
            }
            return result;
        } catch (Throwable t) {
            span.status = "ERROR";
            span.error = t.getClass().getSimpleName() + (t.getMessage() != null ? ": " + t.getMessage() : "");
            span.errorMessage = t.getMessage() != null ? t.getMessage() : t.getClass().getSimpleName();
            span.errorDetail = formatErrorDetail(t);
            throw t;
        } finally {
            ctx.close(span);
        }
    }

    private static String formatErrorDetail(Throwable t) {
        if (t == null) return null;
        StringWriter sw = new StringWriter();
        t.printStackTrace(new PrintWriter(sw));
        return sw.toString();
    }

    private boolean isCaptureRequest(Observe observeAnn, Trace traceAnn) {
        if (observeAnn != null && observeAnn.captureRequest()) return true;
        return traceAnn != null && traceAnn.captureRequest();
    }

    private boolean isCaptureResponse(Observe observeAnn, Trace traceAnn) {
        if (observeAnn != null && observeAnn.captureResponse()) return true;
        return traceAnn != null && traceAnn.captureResponse();
    }

    private ActionOn resolveCategory(Trace traceAnn, Observe observeAnn, Class<?> targetClass) {
        ActionOn cat = ActionOn.AUTO;
        if (observeAnn != null && observeAnn.category() != ActionOn.AUTO) {
            cat = observeAnn.category();
        } else if (traceAnn != null && traceAnn.category() != ActionOn.AUTO) {
            cat = traceAnn.category();
        }
        if (cat == ActionOn.AUTO) {
            if (findClassAnnotation(targetClass, RestController.class) != null
                    || findClassAnnotation(targetClass, Controller.class) != null) {
                return ActionOn.CONTROLLER;
            } else if (findClassAnnotation(targetClass, Service.class) != null) {
                return ActionOn.SERVICE;
            } else if (findClassAnnotation(targetClass, Repository.class) != null) {
                return ActionOn.REPOSITORY;
            }
            return ActionOn.SERVICE;
        }
        return cat;
    }

    private String resolveName(Trace traceAnn, Observe observeAnn, Class<?> targetClass, Method method) {
        if (observeAnn != null) {
            if (!observeAnn.value().isBlank()) return observeAnn.value();
            if (!observeAnn.name().isBlank()) return observeAnn.name();
        }
        if (traceAnn != null) {
            if (!traceAnn.value().isBlank()) return traceAnn.value();
            if (!traceAnn.name().isBlank()) return traceAnn.name();
        }
        return targetClass.getSimpleName() + "." + method.getName();
    }

    /**
     * Resolves an annotation across the specific implementation method, interface method,
     * target class, and any implemented interfaces (ensuring full JDK dynamic proxy & CGLIB support).
     */
    private <A extends Annotation> A findAnnotation(Method method, Method specificMethod, Class<?> targetClass, Class<A> annotationClass) {
        A ann = null;
        if (specificMethod != null) {
            ann = AnnotatedElementUtils.findMergedAnnotation(specificMethod, annotationClass);
            if (ann == null)
                ann = AnnotationUtils.findAnnotation(specificMethod, annotationClass);
        }
        if (ann != null) return ann;
        if (method != null && method != specificMethod) {
            ann = AnnotatedElementUtils.findMergedAnnotation(method, annotationClass);
            if (ann == null)
                ann = AnnotationUtils.findAnnotation(method, annotationClass);
        }
        if (ann != null) return ann;
        return findClassAnnotation(targetClass, annotationClass);
    }

    private <A extends Annotation> A findClassAnnotation(Class<?> targetClass, Class<A> annotationClass) {
        if (targetClass == null) return null;
        A ann = AnnotatedElementUtils.findMergedAnnotation(targetClass, annotationClass);
        if (ann == null) {
            ann = AnnotationUtils.findAnnotation(targetClass, annotationClass);
        }
        if (ann != null) return ann;
        for (Class<?> iface : ClassUtils.getAllInterfacesForClass(targetClass)) {
            ann = AnnotatedElementUtils.findMergedAnnotation(iface, annotationClass);
            if (ann == null)
                ann = AnnotationUtils.findAnnotation(iface, annotationClass);
            if (ann != null) return ann;
        }
        return null;
    }
}
