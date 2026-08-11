package com.hotelbooking.auth.exception;

public class ResourceNotFoundException extends RuntimeException {

    public ResourceNotFoundException(String message) {
        super(message);
    }

    public static ResourceNotFoundException user(Long id) {
        return new ResourceNotFoundException("User " + id + " was not found");
    }
}
