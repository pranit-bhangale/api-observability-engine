package io.github.pranit.exception;

public class BusinessValidationException extends RuntimeException {

    private final String field;

    public BusinessValidationException(String message) {
        this(null, message);
    }

    public BusinessValidationException(String field, String message) {
        super(message);
        this.field = field;
    }

    public String getField() {
        return field;
    }
}
