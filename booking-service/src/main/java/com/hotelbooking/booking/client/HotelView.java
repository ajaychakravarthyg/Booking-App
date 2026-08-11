package com.hotelbooking.booking.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.math.BigDecimal;
import java.util.List;

/**
 * booking-service's view of a property from room-service.
 *
 * <p>Separate from {@link RoomView} on purpose. The alternative was flattening the hotel's
 * description, image and facilities onto every room, which would repeat a paragraph of prose
 * across all 12 rooms of a hotel on every search response. Fetching properties once and
 * joining locally keeps both payloads honest about what they represent.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record HotelView(
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
        Long roomCount,
        /** room-service's date-blind "from" price. This service computes the real one. */
        BigDecimal priceFrom
) {}
