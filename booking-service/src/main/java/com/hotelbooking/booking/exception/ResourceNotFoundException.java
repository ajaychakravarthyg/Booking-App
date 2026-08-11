package com.hotelbooking.booking.exception;

public class ResourceNotFoundException extends RuntimeException {

    public ResourceNotFoundException(String message) {
        super(message);
    }

    public static ResourceNotFoundException booking(Long id) {
        return new ResourceNotFoundException("Booking " + id + " was not found");
    }

    public static ResourceNotFoundException room(Long id) {
        return new ResourceNotFoundException("Room " + id + " was not found");
    }
}
