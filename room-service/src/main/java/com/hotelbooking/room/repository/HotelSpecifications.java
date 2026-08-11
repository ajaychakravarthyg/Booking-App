package com.hotelbooking.room.repository;

import com.hotelbooking.room.domain.Hotel;
import org.springframework.data.jpa.domain.Specification;

/**
 * Composable predicates for hotel search. Each returns null when its parameter is absent,
 * which Spring Data treats as "no restriction".
 */
public final class HotelSpecifications {

    private HotelSpecifications() {
    }

    /**
     * Exact city match, case-insensitive.
     *
     * <p>Deliberately exact rather than a LIKE: the city arrives from the autocomplete,
     * which offers only real values. A substring match would make "York" silently return
     * New York alongside York.
     */
    public static Specification<Hotel> inCity(String city) {
        if (city == null || city.isBlank()) {
            return null;
        }
        String normalized = city.trim().toLowerCase();
        return (root, query, cb) -> cb.equal(cb.lower(root.get("city")), normalized);
    }

    public static Specification<Hotel> inCountry(String country) {
        if (country == null || country.isBlank()) {
            return null;
        }
        String normalized = country.trim().toLowerCase();
        return (root, query, cb) -> cb.equal(cb.lower(root.get("country")), normalized);
    }

    public static Specification<Hotel> isActive(Boolean active) {
        return active == null ? null : (root, query, cb) -> cb.equal(root.get("active"), active);
    }

    public static Specification<Hotel> minimumStars(Integer stars) {
        return stars == null ? null : (root, query, cb) ->
                cb.greaterThanOrEqualTo(root.get("starRating"), stars);
    }

    /** Free-text across hotel name, city, address and property amenities. */
    public static Specification<Hotel> matchesText(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String pattern = "%" + text.trim().toLowerCase() + "%";
        return (root, query, cb) -> cb.or(
                cb.like(cb.lower(root.get("name")), pattern),
                cb.like(cb.lower(root.get("city")), pattern),
                cb.like(cb.lower(cb.coalesce(root.get("address"), "")), pattern),
                cb.like(cb.lower(cb.coalesce(root.get("description"), "")), pattern),
                cb.like(cb.lower(cb.coalesce(root.get("amenities"), "")), pattern));
    }
}
