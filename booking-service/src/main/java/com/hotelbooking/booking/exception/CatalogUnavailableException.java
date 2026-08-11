package com.hotelbooking.booking.exception;

/**
 * room-service could not be reached, or its circuit breaker is open.
 *
 * <p>Maps to {@code 503} with a Retry-After hint, so the UI can say "try again shortly"
 * instead of presenting an outage as a validation error or an empty result set.
 */
public class CatalogUnavailableException extends RuntimeException {

    public CatalogUnavailableException(String message) {
        super(message);
    }
}
