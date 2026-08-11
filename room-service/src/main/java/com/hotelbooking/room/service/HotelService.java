package com.hotelbooking.room.service;

import com.hotelbooking.room.domain.Hotel;
import com.hotelbooking.room.dto.CityResponse;
import com.hotelbooking.room.dto.HotelRequest;
import com.hotelbooking.room.dto.HotelResponse;
import com.hotelbooking.room.exception.DuplicateHotelException;
import com.hotelbooking.room.exception.ResourceNotFoundException;
import com.hotelbooking.room.repository.HotelRepository;
import com.hotelbooking.room.repository.HotelSpecifications;
import com.hotelbooking.room.repository.RoomRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Slf4j
@Service
@RequiredArgsConstructor
public class HotelService {

    private final HotelRepository hotelRepository;
    private final RoomRepository roomRepository;

    // ── Destinations ──────────────────────────────────────────────────────────────

    /**
     * The bookable destination list, for the search autocomplete.
     *
     * <p>Derived from the hotels rather than stored, so it cannot offer a city with nothing
     * in it. Each entry borrows a photo from the best-rated hotel in that city, which gives
     * the destination cards imagery without a separate asset to maintain.
     */
    @Transactional(readOnly = true)
    public List<CityResponse> findCities(String query) {
        // '%' means "no filter". The repository takes a ready-made pattern rather than an
        // optional term because binding a null parameter into an IS NULL test is not
        // portable — see the note on HotelRepository.findCities.
        String pattern = (query == null || query.isBlank())
                ? "%"
                : "%" + query.trim() + "%";

        Map<String, String> imageByCity = representativeImageByCity();

        return hotelRepository.findCities(pattern).stream()
                .map(row -> CityResponse.of(
                        (String) row[0],
                        (String) row[1],
                        ((Number) row[2]).longValue(),
                        imageByCity.get((String) row[0])))
                .toList();
    }

    /**
     * Destinations ordered by how close they are to a point.
     *
     * <p>A city's distance is that of its *nearest* hotel, not a city centroid — the guest cares
     * how far away the thing they can book is.
     *
     * <p>Deliberately does not filter by radius. Someone opening the app in Berlin, where this
     * catalogue has nothing, should still be shown that Edinburgh is 1,300km away rather than an
     * empty list: a nearest-first ordering is useful even when nothing is genuinely near.
     */
    @Transactional(readOnly = true)
    public List<CityResponse> findNearestCities(double latitude, double longitude, int limit) {
        Map<String, String> imageByCity = representativeImageByCity();

        // City -> [country, nearest distance, hotel count]
        Map<String, Object[]> byCity = new LinkedHashMap<>();
        for (Hotel hotel : hotelRepository.findAllGeocoded()) {
            Double distance = GeoDistance.kilometresBetween(
                    hotel.getLatitude(), hotel.getLongitude(),
                    BigDecimal.valueOf(latitude), BigDecimal.valueOf(longitude));
            if (distance == null) {
                continue;
            }
            Object[] existing = byCity.get(hotel.getCity());
            if (existing == null) {
                byCity.put(hotel.getCity(),
                        new Object[]{hotel.getCountry(), distance, 1L});
            } else {
                existing[1] = Math.min((Double) existing[1], distance);
                existing[2] = ((Long) existing[2]) + 1L;
            }
        }

        return byCity.entrySet().stream()
                .map(entry -> new CityResponse(
                        entry.getKey(),
                        (String) entry.getValue()[0],
                        (Long) entry.getValue()[2],
                        imageByCity.get(entry.getKey()),
                        round1((Double) entry.getValue()[1])))
                .sorted(Comparator.comparingDouble(CityResponse::distanceKm))
                .limit(limit)
                .toList();
    }

    /**
     * Hotels within {@code radiusKm} of a point, nearest first.
     *
     * <p>Two stages: a bounding-box query the database can serve from an index, then exact
     * Haversine to trim the box's corners. Filtering by trigonometric distance in SQL would
     * force a full scan and compute a distance for every hotel in the table.
     *
     * <p>Properties without coordinates are excluded rather than treated as distance zero — an
     * ungeocoded hotel is unknown, not nearby.
     */
    @Transactional(readOnly = true)
    public List<HotelResponse> findNearby(double latitude, double longitude, double radiusKm) {
        var box = GeoDistance.boxAround(latitude, longitude, radiusKm);

        List<Hotel> candidates = hotelRepository.findWithinBoundingBox(
                box.minLatitude(), box.maxLatitude(), box.minLongitude(), box.maxLongitude());

        Map<Long, Object[]> summary = roomSummaryByHotelId();
        BigDecimal fromLat = BigDecimal.valueOf(latitude);
        BigDecimal fromLon = BigDecimal.valueOf(longitude);

        record Scored(Hotel hotel, double distance) {}

        return candidates.stream()
                .map(hotel -> new Scored(hotel, GeoDistance.kilometresBetween(
                        hotel.getLatitude(), hotel.getLongitude(), fromLat, fromLon)))
                // The box is a square around a circle, so its corners reach ~1.41× the radius.
                // This is where those extra results are dropped.
                .filter(scored -> scored.distance() <= radiusKm)
                .sorted(Comparator.comparingDouble(Scored::distance))
                .map(scored -> {
                    Object[] row = summary.get(scored.hotel().getId());
                    return HotelResponse.from(
                            scored.hotel(),
                            row == null ? 0L : ((Number) row[2]).longValue(),
                            row == null ? null : (BigDecimal) row[1],
                            round1(scored.distance()));
                })
                .toList();
    }

    /** One km decimal place. Sub-100m precision is noise for a hotel search. */
    private Double round1(Double value) {
        return value == null ? null : Math.round(value * 10.0) / 10.0;
    }

    /**
     * City -> photo of its best-rated hotel.
     *
     * <p>First entry wins because the underlying query is ordered by star rating descending, so a
     * destination card borrows the most flattering image available.
     */
    private Map<String, String> representativeImageByCity() {
        Map<String, String> imageByCity = new HashMap<>();
        for (Object[] row : hotelRepository.findCityImages()) {
            imageByCity.putIfAbsent((String) row[0], (String) row[1]);
        }
        return imageByCity;
    }

    // ── Hotel search ──────────────────────────────────────────────────────────────

    /**
     * Hotels matching the filters, each annotated with its room count and "from" price.
     *
     * <p>Note the price is date-blind: it is the cheapest in-service room, not the cheapest
     * room actually free on given dates. booking-service answers that, because only it can
     * see reservations. The distinction is surfaced in the API docs so a client does not
     * quote this figure as a bookable rate.
     */
    @Transactional(readOnly = true)
    public List<HotelResponse> search(String city, String country, Integer minStars,
                                      String text, Boolean active) {

        Specification<Hotel> spec = Specification.allOf(
                HotelSpecifications.inCity(city),
                HotelSpecifications.inCountry(country),
                HotelSpecifications.minimumStars(minStars),
                HotelSpecifications.matchesText(text),
                HotelSpecifications.isActive(active));

        List<Hotel> hotels = hotelRepository.findAll(spec,
                Sort.by(Sort.Direction.DESC, "starRating").and(Sort.by("name")));

        Map<Long, Object[]> summary = roomSummaryByHotelId();

        return hotels.stream()
                .map(hotel -> {
                    Object[] row = summary.get(hotel.getId());
                    Long count = row == null ? 0L : ((Number) row[2]).longValue();
                    BigDecimal from = row == null ? null : (BigDecimal) row[1];
                    return HotelResponse.from(hotel, count, from);
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public HotelResponse findById(Long id) {
        Hotel hotel = findOrThrow(id);
        Object[] row = roomSummaryByHotelId().get(id);
        return HotelResponse.from(
                hotel,
                row == null ? 0L : ((Number) row[2]).longValue(),
                row == null ? null : (BigDecimal) row[1]);
    }

    // ── Admin ─────────────────────────────────────────────────────────────────────

    @Transactional
    public HotelResponse create(HotelRequest request) {
        String name = request.name().trim();
        String city = request.city().trim();

        // Name alone is not unique — chains reuse names across cities. The pair is.
        if (hotelRepository.existsByNameIgnoreCaseAndCityIgnoreCase(name, city)) {
            throw new DuplicateHotelException(name, city);
        }

        Hotel hotel = hotelRepository.save(Hotel.builder()
                .name(name)
                .city(city)
                .country(request.country().trim())
                .address(trimToNull(request.address()))
                .latitude(request.latitude())
                .longitude(request.longitude())
                .description(trimToNull(request.description()))
                .starRating(request.starRating())
                .imageUrl(trimToNull(request.imageUrl()))
                .amenities(joinAmenities(request.amenities()))
                .active(Boolean.TRUE.equals(request.active()))
                .build());

        log.info("Created hotel id={} '{}' in {}, {}",
                hotel.getId(), hotel.getName(), hotel.getCity(), hotel.getCountry());
        return HotelResponse.from(hotel, 0L, null);
    }

    @Transactional
    public HotelResponse update(Long id, HotelRequest request) {
        Hotel hotel = findOrThrow(id);
        String name = request.name().trim();
        String city = request.city().trim();

        boolean identityChanged = !hotel.getName().equalsIgnoreCase(name)
                || !hotel.getCity().equalsIgnoreCase(city);
        if (identityChanged && hotelRepository.existsByNameIgnoreCaseAndCityIgnoreCase(name, city)) {
            throw new DuplicateHotelException(name, city);
        }

        hotel.setName(name);
        hotel.setCity(city);
        hotel.setCountry(request.country().trim());
        hotel.setAddress(trimToNull(request.address()));
        hotel.setLatitude(request.latitude());
        hotel.setLongitude(request.longitude());
        hotel.setDescription(trimToNull(request.description()));
        hotel.setStarRating(request.starRating());
        hotel.setImageUrl(trimToNull(request.imageUrl()));
        hotel.setAmenities(joinAmenities(request.amenities()));
        hotel.setActive(Boolean.TRUE.equals(request.active()));

        log.info("Updated hotel id={} '{}' in {}", id, hotel.getName(), hotel.getCity());
        return findById(id);
    }

    @Transactional
    public void delete(Long id) {
        Hotel hotel = findOrThrow(id);
        long rooms = roomRepository.countByHotelId(id);

        // Rooms cascade, since a room cannot exist without its hotel. Bookings do not —
        // they live in another service and keep their own snapshot, so historical
        // reservations stay readable while any future one is orphaned. De-listing
        // (active=false) is the non-destructive alternative and is what the API recommends.
        hotelRepository.delete(hotel);
        log.warn("Deleted hotel id={} '{}' along with {} room(s) — any future bookings for "
                + "those rooms are now orphaned", id, hotel.getName(), rooms);
    }

    // ── Shared ────────────────────────────────────────────────────────────────────

    /** hotelId → [hotelId, minPrice, roomCount], in one query rather than per hotel. */
    private Map<Long, Object[]> roomSummaryByHotelId() {
        Map<Long, Object[]> byId = new HashMap<>();
        for (Object[] row : hotelRepository.findRoomPriceSummaryByHotel()) {
            byId.put(((Number) row[0]).longValue(), row);
        }
        return byId;
    }

    Hotel findOrThrow(Long id) {
        return hotelRepository.findById(id)
                .orElseThrow(() -> ResourceNotFoundException.hotel(id));
    }

    private String joinAmenities(List<String> amenities) {
        if (amenities == null || amenities.isEmpty()) {
            return null;
        }
        String joined = amenities.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                // Commas are the storage delimiter, so they cannot survive inside a value.
                .map(s -> s.replace(",", " "))
                .distinct()
                .reduce((a, b) -> a + ", " + b)
                .orElse("");
        return joined.isEmpty() ? null : joined;
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
