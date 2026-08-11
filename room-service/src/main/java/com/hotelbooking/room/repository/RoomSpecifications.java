package com.hotelbooking.room.repository;

import com.hotelbooking.room.domain.Room;
import com.hotelbooking.room.domain.RoomType;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;

/**
 * Composable predicates for the catalog search.
 *
 * <p>Each returns null when its parameter is absent, which Spring Data treats as
 * "no restriction" — so the same query method serves every combination of filters
 * without string-concatenated SQL.
 */
public final class RoomSpecifications {

    private RoomSpecifications() {
    }

    public static Specification<Room> hasType(RoomType type) {
        return type == null ? null : (root, query, cb) -> cb.equal(root.get("type"), type);
    }

    public static Specification<Room> priceAtLeast(BigDecimal min) {
        return min == null ? null : (root, query, cb) ->
                cb.greaterThanOrEqualTo(root.get("pricePerNight"), min);
    }

    public static Specification<Room> priceAtMost(BigDecimal max) {
        return max == null ? null : (root, query, cb) ->
                cb.lessThanOrEqualTo(root.get("pricePerNight"), max);
    }

    public static Specification<Room> capacityAtLeast(Integer guests) {
        return guests == null ? null : (root, query, cb) ->
                cb.greaterThanOrEqualTo(root.get("capacity"), guests);
    }

    public static Specification<Room> isAvailable(Boolean available) {
        return available == null ? null : (root, query, cb) ->
                cb.equal(root.get("available"), available);
    }

    /** Rooms belonging to one property. */
    public static Specification<Room> inHotel(Long hotelId) {
        return hotelId == null ? null : (root, query, cb) ->
                cb.equal(root.get("hotel").get("id"), hotelId);
    }

    /** Every room across every hotel in a city. */
    public static Specification<Room> inCity(String city) {
        if (city == null || city.isBlank()) {
            return null;
        }
        String normalized = city.trim().toLowerCase();
        return (root, query, cb) -> cb.equal(cb.lower(root.get("hotel").get("city")), normalized);
    }

    /**
     * Excludes rooms whose hotel is de-listed.
     *
     * <p>Two flags gate a room: its own {@code available} and its hotel's {@code active}.
     * Without this, taking a property offline would leave its rooms showing in search.
     */
    public static Specification<Room> hotelIsActive() {
        return (root, query, cb) -> cb.isTrue(root.get("hotel").get("active"));
    }

    /**
     * Case-insensitive match across the room and its hotel.
     *
     * <p>Includes hotel name and city so a guest typing "Riverside" or "Lisbon" into the
     * one search box gets sensible results, rather than only matching room descriptions.
     */
    public static Specification<Room> matchesText(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String pattern = "%" + text.trim().toLowerCase() + "%";
        return (root, query, cb) -> {
            var hotel = root.get("hotel");
            return cb.or(
                    cb.like(cb.lower(root.get("roomNumber")), pattern),
                    cb.like(cb.lower(cb.coalesce(root.get("description"), "")), pattern),
                    cb.like(cb.lower(cb.coalesce(root.get("amenities"), "")), pattern),
                    cb.like(cb.lower(hotel.get("name")), pattern),
                    cb.like(cb.lower(hotel.get("city")), pattern));
        };
    }

    /**
     * Forces the hotel association to be loaded in the same query.
     *
     * <p>{@code Room.hotel} is LAZY and {@code RoomResponse} reads five fields off it, so
     * without this a 200-room result triggers 200 extra SELECTs — the classic N+1. Applied
     * only to the results query: adding a fetch to a {@code count} query makes Hibernate
     * throw, and Spring Data issues one for every paged call.
     */
    public static Specification<Room> withHotel() {
        return (root, query, cb) -> {
            if (query != null && Long.class != query.getResultType()
                    && long.class != query.getResultType()) {
                root.fetch("hotel", jakarta.persistence.criteria.JoinType.INNER);
                query.distinct(true);
            }
            return null;
        };
    }
}
