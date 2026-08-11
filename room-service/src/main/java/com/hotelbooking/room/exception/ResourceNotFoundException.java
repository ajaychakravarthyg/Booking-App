package com.hotelbooking.room.exception;

public class ResourceNotFoundException extends RuntimeException {

    public ResourceNotFoundException(String message) {
        super(message);
    }

    public static ResourceNotFoundException room(Long id) {
        return new ResourceNotFoundException("Room " + id + " was not found");
    }
}
