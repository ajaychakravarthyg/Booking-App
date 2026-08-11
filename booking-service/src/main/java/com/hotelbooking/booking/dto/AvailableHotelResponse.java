package com.hotelbooking.booking.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.util.List;

@Schema(description = """
        A suggested property for a destination and date range, with only genuinely bookable
        rooms counted. Unlike room-service's hotel list, every figure here is date-accurate.
        """)
public record AvailableHotelResponse(
        Long hotelId,
        String name,
        String city,
        String country,
        Integer starRating,
        String imageUrl,
        String description,
        List<String> amenities,

        @Schema(description = "Rooms with no overlapping reservation for these dates. "
                + "Always at least 1 — hotels with nothing free are not suggested.")
        int availableRooms,
        @Schema(description = "Total rooms at the property that are in service, free or not. "
                + "The pair conveys scarcity: 1 of 12 reads very differently from 12 of 12.")
        int totalRooms,

        @Schema(description = "Cheapest nightly rate among the AVAILABLE rooms — not the "
                + "property's headline rate, which may belong to a room already taken")
        BigDecimal cheapestPricePerNight,
        @Schema(description = "cheapestPricePerNight × nights, or null when no dates were given")
        BigDecimal cheapestStayTotal,
        @Schema(description = "Highest capacity among the available rooms, so a family can see "
                + "at a glance whether the property can take them")
        Integer maxCapacity,
        Integer nights
) {}
