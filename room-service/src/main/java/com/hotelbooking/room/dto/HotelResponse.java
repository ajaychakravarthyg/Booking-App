package com.hotelbooking.room.dto;

import com.hotelbooking.room.domain.Hotel;
import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;

@Schema(description = "A property in the catalog")
public record HotelResponse(
        Long id,
        String name,
        String city,
        String country,
        String address,
        String description,
        Integer starRating,
        String imageUrl,
        List<String> amenities,
        boolean active,
        @Schema(description = "Number of in-service rooms. Null when not requested.")
        Long roomCount,
        @Schema(description = "Cheapest in-service nightly rate — the 'from' price. "
                + "This ignores dates; for a date-accurate figure use "
                + "GET /api/bookings/search/hotels on booking-service.")
        BigDecimal priceFrom,
        Instant createdAt,
        Instant updatedAt
) {
    public static HotelResponse from(Hotel hotel) {
        return from(hotel, null, null);
    }

    public static HotelResponse from(Hotel hotel, Long roomCount, BigDecimal priceFrom) {
        return new HotelResponse(
                hotel.getId(),
                hotel.getName(),
                hotel.getCity(),
                hotel.getCountry(),
                hotel.getAddress(),
                hotel.getDescription(),
                hotel.getStarRating(),
                hotel.getImageUrl(),
                splitAmenities(hotel.getAmenities()),
                hotel.isActive(),
                roomCount,
                priceFrom,
                hotel.getCreatedAt(),
                hotel.getUpdatedAt());
    }

    static List<String> splitAmenities(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }
}
