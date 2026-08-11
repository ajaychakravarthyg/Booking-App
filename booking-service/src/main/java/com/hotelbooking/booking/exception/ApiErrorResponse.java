package com.hotelbooking.booking.exception;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.Map;

/**
 * The single error shape every endpoint returns, so the React client can render
 * failures without special-casing each route.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
@Schema(description = "Standard error envelope")
public record ApiErrorResponse(
        Instant timestamp,
        int status,
        String error,
        String message,
        String path,
        @Schema(description = "Field name to validation message, present only on validation failures")
        Map<String, String> fieldErrors
) {
    public static ApiErrorResponse of(int status, String error, String message, String path) {
        return new ApiErrorResponse(Instant.now(), status, error, message, path, null);
    }

    public static ApiErrorResponse validation(int status, String message, String path,
                                             Map<String, String> fieldErrors) {
        return new ApiErrorResponse(Instant.now(), status, "Bad Request", message, path, fieldErrors);
    }
}
