package com.hotelbooking.booking.exception;

import java.time.LocalDate;

/**
 * The room exists and is in service, but something else already holds those nights.
 *
 * <p>Maps to {@code 409 Conflict} rather than {@code 400}: the request itself is
 * well-formed, it just lost a race for a contended resource. The distinction matters to
 * the client — a 400 means "fix your input", a 409 means "pick different dates".
 */
public class RoomNotAvailableException extends RuntimeException {

    public RoomNotAvailableException(String roomNumber, LocalDate checkIn, LocalDate checkOut) {
        super("Room " + roomNumber + " is already booked for one or more nights between "
                + checkIn + " and " + checkOut + ". Please choose different dates or another room.");
    }

    public RoomNotAvailableException(String message) {
        super(message);
    }
}
