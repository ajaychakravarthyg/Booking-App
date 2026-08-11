package com.hotelbooking.room.exception;

public class DuplicateRoomNumberException extends RuntimeException {

    /**
     * Scoped to the hotel, because room numbers are only unique within a property — naming
     * the hotel is what makes the message actionable when an admin manages several.
     */
    public DuplicateRoomNumberException(String roomNumber, String hotelName) {
        super("Room '" + roomNumber + "' already exists at " + hotelName);
    }
}
