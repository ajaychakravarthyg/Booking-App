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

    /** Case-insensitive match across room number and description. */
    public static Specification<Room> matchesText(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String pattern = "%" + text.trim().toLowerCase() + "%";
        return (root, query, cb) -> cb.or(
                cb.like(cb.lower(root.get("roomNumber")), pattern),
                cb.like(cb.lower(cb.coalesce(root.get("description"), "")), pattern),
                cb.like(cb.lower(cb.coalesce(root.get("amenities"), "")), pattern));
    }
}
