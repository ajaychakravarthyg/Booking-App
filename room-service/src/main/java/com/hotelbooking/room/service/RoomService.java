package com.hotelbooking.room.service;

import com.hotelbooking.room.domain.Hotel;
import com.hotelbooking.room.domain.Room;
import com.hotelbooking.room.domain.RoomType;
import com.hotelbooking.room.dto.RoomRequest;
import com.hotelbooking.room.dto.RoomResponse;
import com.hotelbooking.room.dto.RoomStatsResponse;
import com.hotelbooking.room.exception.DuplicateRoomNumberException;
import com.hotelbooking.room.exception.ResourceNotFoundException;
import com.hotelbooking.room.repository.HotelRepository;
import com.hotelbooking.room.repository.RoomRepository;
import com.hotelbooking.room.repository.RoomSpecifications;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Objects;

@Slf4j
@Service
@RequiredArgsConstructor
public class RoomService {

    private final RoomRepository roomRepository;
    private final HotelRepository hotelRepository;
    private final HotelService hotelService;

    /**
     * Catalog search across every property, or narrowed to one hotel or city.
     *
     * <p>Two flags gate visibility for a guest: the room's own {@code available} and its
     * hotel's {@code active}. Passing {@code available = true} therefore also excludes rooms
     * in de-listed hotels — otherwise taking a property offline would leave its rooms on sale.
     *
     * <p>Still date-blind. Whether a room is free for particular nights is booking-service's
     * question; it calls this method and subtracts its own overlapping reservations.
     */
    @Transactional(readOnly = true)
    public List<RoomResponse> search(Long hotelId,
                                     String city,
                                     RoomType type,
                                     BigDecimal minPrice,
                                     BigDecimal maxPrice,
                                     Integer guests,
                                     String text,
                                     Boolean available) {

        Specification<Room> spec = Specification.allOf(
                RoomSpecifications.withHotel(),
                RoomSpecifications.inHotel(hotelId),
                RoomSpecifications.inCity(city),
                RoomSpecifications.hasType(type),
                RoomSpecifications.priceAtLeast(minPrice),
                RoomSpecifications.priceAtMost(maxPrice),
                RoomSpecifications.capacityAtLeast(guests),
                RoomSpecifications.matchesText(text),
                RoomSpecifications.isAvailable(available),
                // A guest asking for bookable rooms must not see rooms in a hidden hotel.
                Boolean.TRUE.equals(available) ? RoomSpecifications.hotelIsActive() : null);

        return roomRepository.findAll(spec, Sort.by(Sort.Direction.ASC, "pricePerNight")).stream()
                .map(RoomResponse::from)
                .toList();
    }

    /** Every room in one property, cheapest first — the hotel detail page. */
    @Transactional(readOnly = true)
    public List<RoomResponse> findByHotel(Long hotelId) {
        // Resolve the hotel first so an unknown id is a clean 404 rather than an empty list,
        // which would read as "this hotel has no rooms".
        hotelService.findOrThrow(hotelId);
        return roomRepository.findByHotelIdOrderByPricePerNightAsc(hotelId).stream()
                .map(RoomResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public RoomResponse findById(Long id) {
        return RoomResponse.from(findOrThrow(id));
    }

    @Transactional
    public RoomResponse create(RoomRequest request) {
        Hotel hotel = hotelService.findOrThrow(request.hotelId());
        String roomNumber = request.roomNumber().trim();

        // Scoped to the hotel: two properties may both have a room 101.
        if (roomRepository.existsByHotelIdAndRoomNumberIgnoreCase(hotel.getId(), roomNumber)) {
            throw new DuplicateRoomNumberException(roomNumber, hotel.getName());
        }

        Room room = roomRepository.save(Room.builder()
                .hotel(hotel)
                .roomNumber(roomNumber)
                .type(request.type())
                .pricePerNight(request.pricePerNight())
                .capacity(request.capacity())
                .description(trimToNull(request.description()))
                .imageUrl(trimToNull(request.imageUrl()))
                .amenities(joinAmenities(request.amenities()))
                .available(Boolean.TRUE.equals(request.available()))
                .build());

        log.info("Created room id={} number={} in hotel {} ('{}')",
                room.getId(), room.getRoomNumber(), hotel.getId(), hotel.getName());
        return RoomResponse.from(room);
    }

    @Transactional
    public RoomResponse update(Long id, RoomRequest request) {
        Room room = findOrThrow(id);
        Hotel hotel = hotelService.findOrThrow(request.hotelId());
        String roomNumber = request.roomNumber().trim();

        // Uniqueness must be re-checked when either the number OR the owning hotel changes —
        // moving room 101 into a hotel that already has a 101 is just as much a clash.
        boolean identityChanged = !Objects.equals(room.getHotel().getId(), hotel.getId())
                || !room.getRoomNumber().equalsIgnoreCase(roomNumber);
        if (identityChanged
                && roomRepository.existsByHotelIdAndRoomNumberIgnoreCase(hotel.getId(), roomNumber)) {
            throw new DuplicateRoomNumberException(roomNumber, hotel.getName());
        }

        room.setHotel(hotel);
        room.setRoomNumber(roomNumber);
        room.setType(request.type());
        room.setPricePerNight(request.pricePerNight());
        room.setCapacity(request.capacity());
        room.setDescription(trimToNull(request.description()));
        room.setImageUrl(trimToNull(request.imageUrl()));
        room.setAmenities(joinAmenities(request.amenities()));
        room.setAvailable(Boolean.TRUE.equals(request.available()));

        // Existing bookings intentionally keep the price they were made at — they store
        // their own snapshot — so a rate change never rewrites past reservations.
        log.info("Updated room id={} number={} hotel={}", id, room.getRoomNumber(), hotel.getId());
        return RoomResponse.from(room);
    }

    @Transactional
    public void delete(Long id) {
        Room room = findOrThrow(id);

        // room-service cannot see bookings, and asking booking-service here would create a
        // dependency cycle between the two. Past bookings survive intact because they hold a
        // denormalized copy of the room; future ones would be orphaned, so the API documents
        // deactivation (available=false) as the safe alternative.
        roomRepository.delete(room);
        log.warn("Deleted room id={} number={} from hotel {} — any future bookings for it are "
                + "now orphaned", id, room.getRoomNumber(), room.getHotel().getId());
    }

    @Transactional(readOnly = true)
    public RoomStatsResponse stats() {
        long total = roomRepository.count();
        long available = roomRepository.countByAvailable(true);

        List<RoomStatsResponse.RoomTypeCount> byType = roomRepository.countGroupedByType().stream()
                .map(row -> {
                    RoomType type = (RoomType) row[0];
                    long count = ((Number) row[1]).longValue();
                    return new RoomStatsResponse.RoomTypeCount(type, type.getLabel(), count);
                })
                .toList();

        Object[] prices = roomRepository.priceAggregates().stream().findFirst()
                .orElse(new Object[]{0, 0, 0});

        return new RoomStatsResponse(
                total,
                available,
                total - available,
                hotelRepository.count(),
                hotelRepository.countByActive(true),
                hotelRepository.countDistinctActiveCities(),
                money(prices[0]),
                money(prices[1]),
                money(prices[2]),
                byType);
    }

    private Room findOrThrow(Long id) {
        // findWithHotelById, not findById — RoomResponse reads five fields off the LAZY
        // hotel, which would otherwise fail once the transaction closes.
        return roomRepository.findWithHotelById(id)
                .orElseThrow(() -> ResourceNotFoundException.room(id));
    }

    /** avg() comes back as a Double from Hibernate, min()/max() as BigDecimal. */
    private BigDecimal money(Object value) {
        if (value == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        BigDecimal decimal = (value instanceof BigDecimal bd)
                ? bd
                : BigDecimal.valueOf(((Number) value).doubleValue());
        return decimal.setScale(2, RoundingMode.HALF_UP);
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
