package com.hotelbooking.booking.service;

import com.hotelbooking.booking.client.RoomClient;
import com.hotelbooking.booking.client.RoomView;
import com.hotelbooking.booking.domain.Booking;
import com.hotelbooking.booking.domain.BookingStatus;
import com.hotelbooking.booking.dto.AvailableRoomResponse;
import com.hotelbooking.booking.dto.BookingRequest;
import com.hotelbooking.booking.dto.BookingResponse;
import com.hotelbooking.booking.dto.BookingStatsResponse;
import com.hotelbooking.booking.exception.BadRequestException;
import com.hotelbooking.booking.exception.ResourceNotFoundException;
import com.hotelbooking.booking.exception.RoomNotAvailableException;
import com.hotelbooking.booking.repository.BookingRepository;
import com.hotelbooking.booking.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class BookingService {

    private final BookingRepository bookingRepository;
    private final ReservationWriter reservationWriter;
    private final RoomLockRegistrar roomLockRegistrar;
    private final RoomClient roomClient;

    @Value("${app.booking.max-nights:30}")
    private int maxNights;

    @Value("${app.booking.max-days-in-advance:365}")
    private int maxDaysInAdvance;

    // ── Creating a booking ────────────────────────────────────────────────────────

    /**
     * Books a room for the authenticated guest.
     *
     * <p>Not {@code @Transactional} by design — the catalog lookup below is a network
     * call, and {@link ReservationWriter} owns the short transaction that follows it.
     */
    public BookingResponse create(BookingRequest request, AuthenticatedUser guest) {
        LocalDate checkIn = request.checkInDate();
        LocalDate checkOut = request.checkOutDate();
        int nights = validateStay(checkIn, checkOut);

        RoomView room = roomClient.findById(request.roomId());

        // The admin master switch. A room out of service cannot be booked for any dates,
        // regardless of whether the calendar happens to be clear.
        if (!room.available()) {
            throw new RoomNotAvailableException(
                    "Room " + room.roomNumber() + " is currently not available for booking.");
        }

        // Must happen in its own committed transaction before reserve() tries to lock
        // the row, so it is deliberately a separate call rather than folded into
        // ReservationWriter.
        roomLockRegistrar.ensureExists(room.id());

        Booking booking = reservationWriter.reserve(room, guest, checkIn, checkOut, nights);
        return BookingResponse.from(booking);
    }

    // ── Date-aware availability search ────────────────────────────────────────────

    /**
     * The catalog, minus anything already reserved for the requested nights.
     *
     * <p>Lives here rather than in room-service because only this service can see
     * bookings. room-service stays a pure catalog and never needs to call back, which
     * keeps the two services acyclic.
     *
     * <p>Dates are optional: without them this is a plain catalog browse, and each
     * result simply carries no stay total.
     */
    @Transactional(readOnly = true)
    public List<AvailableRoomResponse> searchAvailable(LocalDate checkIn,
                                                       LocalDate checkOut,
                                                       String type,
                                                       BigDecimal minPrice,
                                                       BigDecimal maxPrice,
                                                       Integer guests,
                                                       String q) {

        // Only in-service rooms are offered to guests.
        List<RoomView> catalog = roomClient.search(type, minPrice, maxPrice, guests, q, true);

        if (checkIn == null && checkOut == null) {
            return catalog.stream()
                    .map(room -> AvailableRoomResponse.from(room, null, null))
                    .toList();
        }
        if (checkIn == null || checkOut == null) {
            throw new BadRequestException(
                    "Provide both checkIn and checkOut to search by date, or neither to browse all rooms");
        }

        int nights = validateStay(checkIn, checkOut);

        // One query for every clashing room, rather than an overlap probe per room —
        // otherwise a 200-room catalog costs 200 round trips.
        Set<Long> booked = bookingRepository.findBookedRoomIds(checkIn, checkOut);

        return catalog.stream()
                .filter(room -> !booked.contains(room.id()))
                .map(room -> AvailableRoomResponse.from(
                        room,
                        nights,
                        room.pricePerNight()
                                .multiply(BigDecimal.valueOf(nights))
                                .setScale(2, RoundingMode.HALF_UP)))
                .toList();
    }

    /** Powers the "is this room free?" check on the room detail page. */
    @Transactional(readOnly = true)
    public boolean isAvailable(Long roomId, LocalDate checkIn, LocalDate checkOut) {
        validateStay(checkIn, checkOut);
        RoomView room = roomClient.findById(roomId);
        return room.available() && !bookingRepository.existsOverlapping(roomId, checkIn, checkOut);
    }

    // ── Reading bookings ──────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<BookingResponse> findMyBookings(AuthenticatedUser guest) {
        LocalDate today = LocalDate.now();
        return bookingRepository.findByUserId(guest.id(), newestFirst()).stream()
                .map(booking -> BookingResponse.from(booking, today))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<BookingResponse> findAll(BookingStatus status) {
        LocalDate today = LocalDate.now();
        List<Booking> bookings = (status == null)
                ? bookingRepository.findAll(newestFirst())
                : bookingRepository.findByStatus(status, newestFirst());

        return bookings.stream()
                .map(booking -> BookingResponse.from(booking, today))
                .toList();
    }

    /**
     * A customer may only read their own booking; an admin may read any.
     *
     * <p>A customer asking for someone else's id gets 404, not 403 — a 403 would confirm
     * that the booking exists, letting an attacker enumerate ids.
     */
    @Transactional(readOnly = true)
    public BookingResponse findById(Long bookingId, AuthenticatedUser principal) {
        Booking booking = principal.isAdmin()
                ? bookingRepository.findById(bookingId)
                        .orElseThrow(() -> ResourceNotFoundException.booking(bookingId))
                : bookingRepository.findByIdAndUserId(bookingId, principal.id())
                        .orElseThrow(() -> ResourceNotFoundException.booking(bookingId));

        return BookingResponse.from(booking);
    }

    // ── Cancelling ────────────────────────────────────────────────────────────────

    @Transactional
    public BookingResponse cancel(Long bookingId, AuthenticatedUser principal) {
        Booking booking = principal.isAdmin()
                ? bookingRepository.findById(bookingId)
                        .orElseThrow(() -> ResourceNotFoundException.booking(bookingId))
                : bookingRepository.findByIdAndUserId(bookingId, principal.id())
                        .orElseThrow(() -> ResourceNotFoundException.booking(bookingId));

        if (booking.getStatus() == BookingStatus.CANCELLED) {
            throw new BadRequestException("This booking has already been cancelled");
        }
        if (booking.getCheckInDate().isBefore(LocalDate.now())) {
            throw new BadRequestException(
                    "This stay has already started and can no longer be cancelled");
        }

        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancelledAt(Instant.now());

        // The row stays in place with CANCELLED status rather than being deleted: the
        // overlap query filters on CONFIRMED, so the nights free up immediately while
        // the audit trail survives.
        log.info("Cancelled booking id={} room={} by {}",
                booking.getId(), booking.getRoomNumber(), principal.email());
        return BookingResponse.from(booking);
    }

    // ── Dashboard ─────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public BookingStatsResponse stats(LocalDate from, LocalDate to) {
        LocalDate today = LocalDate.now();
        LocalDate start = from != null ? from : today.minusDays(15);
        LocalDate end = to != null ? to : today.plusDays(30);
        if (end.isBefore(start)) {
            throw new BadRequestException("'to' must not be before 'from'");
        }

        long confirmed = bookingRepository.countByStatus(BookingStatus.CONFIRMED);
        long cancelled = bookingRepository.countByStatus(BookingStatus.CANCELLED);
        BigDecimal revenue = bookingRepository.totalConfirmedRevenue().setScale(2, RoundingMode.HALF_UP);

        BigDecimal average = confirmed == 0
                ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP)
                : revenue.divide(BigDecimal.valueOf(confirmed), 2, RoundingMode.HALF_UP);

        return new BookingStatsResponse(
                confirmed + cancelled,
                confirmed,
                cancelled,
                bookingRepository.countUpcomingArrivals(today),
                revenue,
                average,
                buildDailySeries(start, end));
    }

    /**
     * Fills gaps so the chart has one point per day.
     *
     * <p>Without this, Recharts would join 3 Sept straight to 11 Sept as if they were
     * adjacent, visually compressing a quiet week into a steep line.
     */
    private List<BookingStatsResponse.DailyPoint> buildDailySeries(LocalDate start, LocalDate end) {
        Map<LocalDate, Object[]> byDate = new HashMap<>();
        for (Object[] row : bookingRepository.arrivalsPerDay(start, end)) {
            byDate.put((LocalDate) row[0], row);
        }

        List<BookingStatsResponse.DailyPoint> series = new ArrayList<>();
        for (LocalDate date = start; !date.isAfter(end); date = date.plusDays(1)) {
            Object[] row = byDate.get(date);
            if (row == null) {
                series.add(new BookingStatsResponse.DailyPoint(date, 0L,
                        BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP)));
            } else {
                series.add(new BookingStatsResponse.DailyPoint(
                        date,
                        ((Number) row[1]).longValue(),
                        ((BigDecimal) row[2]).setScale(2, RoundingMode.HALF_UP)));
            }
        }
        return series;
    }

    // ── Shared rules ──────────────────────────────────────────────────────────────

    /**
     * Validates the stay and returns its length in nights.
     *
     * <p>Bean validation already covers "not null", "not in the past" and
     * "check-out after check-in". What is left are the rules that need arithmetic:
     * an upper bound on stay length and on how far ahead a booking may be made — both
     * of which stop a single request from blocking a room for years.
     */
    private int validateStay(LocalDate checkIn, LocalDate checkOut) {
        if (checkIn == null || checkOut == null) {
            throw new BadRequestException("Both checkIn and checkOut are required");
        }
        if (!checkOut.isAfter(checkIn)) {
            throw new BadRequestException("Check-out date must be after check-in date");
        }

        long nights = ChronoUnit.DAYS.between(checkIn, checkOut);
        if (nights > maxNights) {
            throw new BadRequestException(
                    "A single booking may not exceed " + maxNights + " nights (requested " + nights + ")");
        }

        long daysAhead = ChronoUnit.DAYS.between(LocalDate.now(), checkIn);
        if (daysAhead > maxDaysInAdvance) {
            throw new BadRequestException(
                    "Bookings can be made at most " + maxDaysInAdvance + " days in advance");
        }

        return (int) nights;
    }

    private Sort newestFirst() {
        return Sort.by(Sort.Direction.DESC, "createdAt");
    }
}
