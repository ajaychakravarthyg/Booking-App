package com.hotelbooking.room.service;

import com.hotelbooking.room.domain.Room;
import com.hotelbooking.room.domain.RoomType;
import com.hotelbooking.room.dto.RoomRequest;
import com.hotelbooking.room.dto.RoomResponse;
import com.hotelbooking.room.dto.RoomStatsResponse;
import com.hotelbooking.room.exception.DuplicateRoomNumberException;
import com.hotelbooking.room.exception.ResourceNotFoundException;
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

    /**
     * Catalog search. Any parameter may be null, in which case it applies no restriction.
     *
     * <p>Note this filters on the room's in-service flag only. Whether a room is free
     * for particular dates is answered by booking-service, which calls this method and
     * then subtracts its own overlapping reservations.
     */
    @Transactional(readOnly = true)
    public List<RoomResponse> search(RoomType type,
                                     BigDecimal minPrice,
                                     BigDecimal maxPrice,
                                     Integer guests,
                                     String text,
                                     Boolean available) {

        Specification<Room> spec = Specification.allOf(
                RoomSpecifications.hasType(type),
                RoomSpecifications.priceAtLeast(minPrice),
                RoomSpecifications.priceAtMost(maxPrice),
                RoomSpecifications.capacityAtLeast(guests),
                RoomSpecifications.matchesText(text),
                RoomSpecifications.isAvailable(available));

        return roomRepository.findAll(spec, Sort.by(Sort.Direction.ASC, "pricePerNight")).stream()
                .map(RoomResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public RoomResponse findById(Long id) {
        return RoomResponse.from(findOrThrow(id));
    }

    @Transactional
    public RoomResponse create(RoomRequest request) {
        String roomNumber = request.roomNumber().trim();
        if (roomRepository.existsByRoomNumberIgnoreCase(roomNumber)) {
            throw new DuplicateRoomNumberException(roomNumber);
        }

        Room room = roomRepository.save(Room.builder()
                .roomNumber(roomNumber)
                .type(request.type())
                .pricePerNight(request.pricePerNight())
                .capacity(request.capacity())
                .description(trimToNull(request.description()))
                .imageUrl(trimToNull(request.imageUrl()))
                .amenities(joinAmenities(request.amenities()))
                .available(Boolean.TRUE.equals(request.available()))
                .build());

        log.info("Created room id={} number={} type={}", room.getId(), room.getRoomNumber(), room.getType());
        return RoomResponse.from(room);
    }

    @Transactional
    public RoomResponse update(Long id, RoomRequest request) {
        Room room = findOrThrow(id);
        String roomNumber = request.roomNumber().trim();

        // Renaming onto another room's number must fail, but keeping your own is fine.
        if (!room.getRoomNumber().equalsIgnoreCase(roomNumber)
                && roomRepository.existsByRoomNumberIgnoreCase(roomNumber)) {
            throw new DuplicateRoomNumberException(roomNumber);
        }

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
        log.info("Updated room id={} number={}", room.getId(), room.getRoomNumber());
        return RoomResponse.from(room);
    }

    @Transactional
    public void delete(Long id) {
        Room room = findOrThrow(id);

        // room-service cannot see bookings, and asking booking-service here would create
        // a dependency cycle between the two. Past bookings survive intact because they
        // hold a denormalized copy of the room; future ones would be orphaned, so the
        // API documents deactivation (available=false) as the safe alternative.
        roomRepository.delete(room);
        log.warn("Deleted room id={} number={} — any future bookings for it are now orphaned",
                id, room.getRoomNumber());
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
                money(prices[0]),
                money(prices[1]),
                money(prices[2]),
                byType);
    }

    private Room findOrThrow(Long id) {
        return roomRepository.findById(id)
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
