package com.hotelbooking.room.exception;

public class DuplicateHotelException extends RuntimeException {

    public DuplicateHotelException(String name, String city) {
        // Scoped to the city: a chain legitimately has "The Grand" in several cities, so
        // only the name-plus-city pair is a genuine duplicate.
        super("A hotel named '" + name + "' already exists in " + city);
    }
}
