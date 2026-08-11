package com.hotelbooking.room.dto;

import com.hotelbooking.room.domain.Room;
import com.hotelbooking.room.domain.RoomType;
import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;

@Schema(description = "A room in the catalog")
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
        Instant createdAt,
        Instant updatedAt
) {
    public static RoomResponse from(Room room) {
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
