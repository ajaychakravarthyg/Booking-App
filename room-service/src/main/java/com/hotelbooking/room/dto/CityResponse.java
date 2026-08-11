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
        String imageUrl,
        @Schema(description = "Distance in km from the searched point, to the nearest hotel in "
                + "this city. Present only for /api/cities/nearest.")
        Double distanceKm
) {
    /** Same city with no distance, for the plain (non-geo) listing. */
    public static CityResponse of(String city, String country, long hotelCount, String imageUrl) {
        return new CityResponse(city, country, hotelCount, imageUrl, null);
    }

    /** "Lisbon, Portugal" — what the autocomplete shows. */
    public String label() {
        return city + ", " + country;
    }
}
