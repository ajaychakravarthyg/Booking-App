package com.hotelbooking.booking.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.math.BigDecimal;
import java.util.List;

/**
 * booking-service's view of a room from room-service.
 *
 * <p>Intentionally a separate type from room-service's own {@code RoomResponse}: the two
 * services share no compiled code, so the contract between them is the JSON on the wire.
 * Duplicating this small record is what lets each service be built, versioned and deployed
 * on its own.
 *
 * <p>{@code ignoreUnknown = true} matters — room-service can add fields without breaking
 * deserialization here, so the two can be released independently. The hotel fields below
 * arrived exactly that way: room-service started sending them and this record picked them up
 * with no coordinated deploy.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record RoomView(
        Long id,
        String roomNumber,
        String type,
        String typeLabel,
        BigDecimal pricePerNight,
        Integer capacity,
        String description,
        String imageUrl,
        List<String> amenities,
        boolean available,

        // ── Owning property, flattened by room-service ────────────────────────────────
        Long hotelId,
        String hotelName,
        String hotelCity,
        String hotelCountry,
        Integer hotelStarRating
) {}
