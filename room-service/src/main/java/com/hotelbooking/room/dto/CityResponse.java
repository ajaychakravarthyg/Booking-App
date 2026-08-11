package com.hotelbooking.room.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "A bookable destination, derived from the hotels that exist in it")
public record CityResponse(
        String city,
        String country,
        @Schema(description = "Active hotels in this city")
        long hotelCount,
        @Schema(description = "A representative photo, borrowed from the highest-rated "
                + "hotel in the city")
        String imageUrl
) {
    /** "Lisbon, Portugal" — what the autocomplete shows. */
    public String label() {
        return city + ", " + country;
    }
}
