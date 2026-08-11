package com.hotelbooking.booking.dto;

import com.hotelbooking.booking.client.RoomView;
import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.util.List;

@Schema(description = """
        A room that is genuinely bookable for the requested dates, already priced for the
        whole stay so the UI does not have to recompute it, and carrying its property so a
        result card needs no second request.
        """)
public record AvailableRoomResponse(
        Long id,
        String roomNumber,
        String type,
        String typeLabel,
        BigDecimal pricePerNight,
        Integer capacity,
        String description,
        String imageUrl,
        List<String> amenities,

        // ── Owning property ───────────────────────────────────────────────────────────
        // A room number alone is meaningless across a multi-hotel catalogue: "101" needs
        // to say whose 101 it is.
        Long hotelId,
        String hotelName,
        String hotelCity,
        String hotelCountry,
        Integer hotelStarRating,

        @Schema(description = "Nights in the requested range, or null when no dates were given")
        Integer nights,
        @Schema(description = "pricePerNight × nights, or null when no dates were given")
        BigDecimal totalPrice
) {
    public static AvailableRoomResponse from(RoomView room, Integer nights, BigDecimal totalPrice) {
        return new AvailableRoomResponse(
                room.id(),
                room.roomNumber(),
                room.type(),
                room.typeLabel(),
                room.pricePerNight(),
                room.capacity(),
                room.description(),
                room.imageUrl(),
                room.amenities() == null ? List.of() : room.amenities(),
                room.hotelId(),
                room.hotelName(),
                room.hotelCity(),
                room.hotelCountry(),
                room.hotelStarRating(),
                nights,
                totalPrice);
    }
}
