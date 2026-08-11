package com.hotelbooking.room.domain;

import lombok.Getter;

@Getter
public enum RoomType {

    SINGLE("Single", 1),
    DOUBLE("Double", 2),
    TWIN("Twin", 2),
    SUITE("Suite", 4),
    DELUXE("Deluxe", 3);

    private final String label;
    /** Typical occupancy, used only as a sensible default in the admin form. */
    private final int suggestedCapacity;

    RoomType(String label, int suggestedCapacity) {
        this.label = label;
        this.suggestedCapacity = suggestedCapacity;
    }
}
