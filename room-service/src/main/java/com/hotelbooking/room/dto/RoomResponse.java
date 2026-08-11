package com.hotelbooking.room.dto;

import com.hotelbooking.room.domain.Room;
import com.hotelbooking.room.domain.RoomType;
import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;

@Schema(description = "A room, including just enough of its hotel to render a result card "
        + "without a second request")
public record RoomResponse(
        Long id,
        String roomNumber,
        RoomType type,
        @Schema(description = "Human-readable room type", example = "Double")
        String typeLabel,
        BigDecimal pricePerNight,
        Integer capacity,
        String description,
        String imageUrl,
        List<String> amenities,
        boolean available,

        // ── Owning property ───────────────────────────────────────────────────────────
        // Flattened rather than nested so booking-service and the UI can read hotel context
        // straight off a room. Only the fields a card or booking snapshot needs — not the
        // whole Hotel, which would drag its own amenities and description into every row.
        Long hotelId,
        String hotelName,
        String hotelCity,
        String hotelCountry,
        Integer hotelStarRating,

        Instant createdAt,
        Instant updatedAt
) {
    /**
     * @param room must have its {@code hotel} association loaded — the field is LAZY, so
     *             callers query with a fetch join or run inside a transaction.
     */
    public static RoomResponse from(Room room) {
        var hotel = room.getHotel();
        return new RoomResponse(
                room.getId(),
                room.getRoomNumber(),
                room.getType(),
                room.getType().getLabel(),
                room.getPricePerNight(),
                room.getCapacity(),
                room.getDescription(),
                room.getImageUrl(),
                splitAmenities(room.getAmenities()),
                room.isAvailable(),
                hotel == null ? null : hotel.getId(),
                hotel == null ? null : hotel.getName(),
                hotel == null ? null : hotel.getCity(),
                hotel == null ? null : hotel.getCountry(),
                hotel == null ? null : hotel.getStarRating(),
                room.getCreatedAt(),
                room.getUpdatedAt());
    }

    private static List<String> splitAmenities(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }
}
