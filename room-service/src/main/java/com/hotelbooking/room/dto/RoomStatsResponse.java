package com.hotelbooking.room.dto;

import com.hotelbooking.room.domain.RoomType;
import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.util.List;

@Schema(description = "Catalog aggregates feeding the admin dashboard charts")
public record RoomStatsResponse(
        long totalRooms,
        long availableRooms,
        long outOfServiceRooms,
        long totalHotels,
        long activeHotels,
        @Schema(description = "Distinct cities with at least one listed hotel — the number "
                + "of destinations a guest can actually search")
        long totalCities,
        BigDecimal averagePricePerNight,
        BigDecimal lowestPricePerNight,
        BigDecimal highestPricePerNight,
        List<RoomTypeCount> byType
) {
    @Schema(description = "One slice of the 'rooms by type' chart")
    public record RoomTypeCount(RoomType type, String label, long count) {}
}
