package com.hotelbooking.room.repository;

import com.hotelbooking.room.domain.Hotel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface HotelRepository extends JpaRepository<Hotel, Long>, JpaSpecificationExecutor<Hotel> {

    boolean existsByNameIgnoreCaseAndCityIgnoreCase(String name, String city);

    Optional<Hotel> findByNameIgnoreCaseAndCityIgnoreCase(String name, String city);

    /**
     * The distinct city list that powers search autocomplete.
     *
     * <p>Derived from the hotels themselves rather than kept in a lookup table, so it can
     * never list a city with nothing to book, and never miss one that was just added.
     *
     * <p>Counts only active hotels — offering a city that resolves to an empty result page is
     * worse than not offering it.
     *
     * <p>Takes an already-built LIKE pattern rather than an optional term, because the
     * obvious {@code (:query is null or ... like ...)} form is not portable: PostgreSQL
     * cannot infer the type of a parameter that appears only in an {@code IS NULL} test and
     * fails the whole statement, while H2 accepts it happily. Passing {@code '%'} for
     * "no filter" sidesteps the typed-null problem entirely and keeps one code path.
     */
    @Query("""
            select h.city, h.country, count(h)
            from Hotel h
            where h.active = true
              and lower(h.city) like lower(:pattern)
            group by h.city, h.country
            order by count(h) desc, h.city asc
            """)
    List<Object[]> findCities(@Param("pattern") String pattern);

    /**
     * One representative image per city, for the destination cards.
     *
     * <p>Ordered best-rated first so the caller can take the first row per city and get the
     * most flattering photo. {@code nulls last} keeps unrated properties from winning.
     */
    @Query("""
            select h.city, h.imageUrl from Hotel h
            where h.active = true and h.imageUrl is not null
            order by h.starRating desc nulls last, h.id asc
            """)
    List<Object[]> findCityImages();

    /**
     * Listed hotels inside a latitude/longitude box.
     *
     * <p>The box is the cheap half of a two-stage radius search: it is index-friendly and
     * over-selects slightly, and the caller trims the corners with exact Haversine. Doing the
     * trigonometry in SQL instead would mean computing a distance for every row in the table
     * and could use no index at all.
     */
    @Query("""
            select h from Hotel h
            where h.active = true
              and h.latitude is not null
              and h.longitude is not null
              and h.latitude between :minLat and :maxLat
              and h.longitude between :minLon and :maxLon
            """)
    List<Hotel> findWithinBoundingBox(@Param("minLat") double minLat,
                                      @Param("maxLat") double maxLat,
                                      @Param("minLon") double minLon,
                                      @Param("maxLon") double maxLon);

    /** Every listed, geocoded hotel — the fallback when a radius search finds nothing nearby. */
    @Query("""
            select h from Hotel h
            where h.active = true and h.latitude is not null and h.longitude is not null
            """)
    List<Hotel> findAllGeocoded();

    long countByActive(boolean active);

    @Query("select count(distinct h.city) from Hotel h where h.active = true")
    long countDistinctActiveCities();

    /**
     * Cheapest in-service room per hotel, and how many there are.
     *
     * <p>Aggregated in one query so the hotel list can show "from $X · N rooms" without an
     * N+1 walk over every hotel's rooms.
     */
    @Query("""
            select r.hotel.id, min(r.pricePerNight), count(r)
            from Room r
            where r.available = true
            group by r.hotel.id
            """)
    List<Object[]> findRoomPriceSummaryByHotel();
}
