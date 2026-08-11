package com.hotelbooking.booking.domain;

public enum BookingStatus {

    /** Holds the room for its date range and blocks any overlapping reservation. */
    CONFIRMED,

    /** Released. Ignored by every availability check, so the dates free up again. */
    CANCELLED
}
