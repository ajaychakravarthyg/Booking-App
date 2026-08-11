package com.hotelbooking.booking.service;

import com.hotelbooking.booking.client.RoomView;
import com.hotelbooking.booking.domain.Booking;
import com.hotelbooking.booking.domain.BookingStatus;
import com.hotelbooking.booking.exception.RoomNotAvailableException;
import com.hotelbooking.booking.repository.BookingRepository;
import com.hotelbooking.booking.repository.RoomLockRepository;
import com.hotelbooking.booking.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;

/**
 * The transactional half of making a booking: re-check availability under a row lock,
 * then insert.
 *
 * <p>This is a separate bean from {@link BookingService} on purpose. The catalog lookup
 * is a network call to room-service, and running it inside the transaction would pin a
 * database connection for its whole duration — under load that exhausts the pool on
 * whichever service is slowest, not the one that is actually busy. So orchestration and
 * the network hop live in BookingService; only the short critical section is here.
 *
 * <p>It also gives the {@code @Transactional} proxy a real boundary to wrap: calling an
 * annotated method on {@code this} from within the same class bypasses the proxy
 * entirely and would silently run with no transaction at all.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReservationWriter {

    private final BookingRepository bookingRepository;
    private final RoomLockRepository roomLockRepository;

    @Transactional
    public Booking reserve(RoomView room, AuthenticatedUser guest,
                           LocalDate checkIn, LocalDate checkOut, int nights) {

        // Serialise every attempt on this room before looking at anything else. Without
        // this, concurrent requests for a room with no existing bookings would all read
        // an empty conflict set and all insert — see RoomLock for the full explanation.
        // The row is created by RoomLockRegistrar just before this call.
        roomLockRepository.findAndLock(room.id()).orElseThrow(() -> new IllegalStateException(
                "Lock row for room " + room.id() + " is missing; RoomLockRegistrar should "
                        + "have created it before reserve() was called"));

        // Re-checked inside the transaction. An availability answer from the search
        // screen is already stale by the time it reaches here.
        var conflicts = bookingRepository.findOverlappingForUpdate(room.id(), checkIn, checkOut);
        if (!conflicts.isEmpty()) {
            log.info("Rejected booking for room {} — {} overlapping reservation(s) between {} and {}",
                    room.roomNumber(), conflicts.size(), checkIn, checkOut);
            throw new RoomNotAvailableException(room.roomNumber(), checkIn, checkOut);
        }

        BigDecimal totalPrice = room.pricePerNight()
                .multiply(BigDecimal.valueOf(nights))
                .setScale(2, RoundingMode.HALF_UP);

        Booking booking = bookingRepository.save(Booking.builder()
                // Guest identity comes from the verified token, never the request body.
                .userId(guest.id())
                .userEmail(guest.email())
                .userName(guest.name() == null ? guest.email() : guest.name())
                // Room details are snapshotted so this record stays truthful after the
                // catalog changes.
                .roomId(room.id())
                .roomNumber(room.roomNumber())
                .roomType(room.type())
                .pricePerNight(room.pricePerNight())
                .checkInDate(checkIn)
                .checkOutDate(checkOut)
                .nights(nights)
                .totalPrice(totalPrice)
                .status(BookingStatus.CONFIRMED)
                .build());

        log.info("Confirmed booking id={} room={} guest={} {}→{} ({} nights, total {})",
                booking.getId(), room.roomNumber(), guest.email(), checkIn, checkOut, nights, totalPrice);
        return booking;
    }
}
