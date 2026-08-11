package com.hotelbooking.booking.controller;

import com.hotelbooking.booking.domain.BookingStatus;
import com.hotelbooking.booking.dto.AvailableHotelResponse;
import com.hotelbooking.booking.dto.AvailableRoomResponse;
import com.hotelbooking.booking.dto.BookingRequest;
import com.hotelbooking.booking.dto.BookingResponse;
import com.hotelbooking.booking.dto.BookingStatsResponse;
import com.hotelbooking.booking.security.AuthenticatedUser;
import com.hotelbooking.booking.service.BookingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Tag(name = "Bookings", description = "Availability search, reservations and cancellation")
@RestController
@RequestMapping("/api/bookings")
@RequiredArgsConstructor
public class BookingController {

    private final BookingService bookingService;

    // ── Public search ─────────────────────────────────────────────────────────────

    @Operation(summary = "Search rooms that are actually free for the given dates",
            description = """
                    Public — visitors can search before signing up.

                    Starts from room-service's catalog and removes every room with a
                    confirmed reservation overlapping the range, so unlike
                    `GET /api/rooms` this result is date-accurate. Each entry also carries
                    the night count and the total for the stay.

                    Omit both dates to browse the whole catalog; supplying only one is a
                    400.
                    """)
    @GetMapping("/search")
    public ResponseEntity<List<AvailableRoomResponse>> search(
            @Parameter(description = "Restrict to one property — the hotel detail page uses this")
            @RequestParam(required = false) Long hotelId,

            @Parameter(description = "Every hotel's rooms in this city (exact match, as "
                    + "returned by /api/cities)")
            @RequestParam(required = false) String city,

            @Parameter(description = "First night, ISO yyyy-MM-dd", example = "2026-09-14")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkIn,

            @Parameter(description = "Departure day — not charged as a night", example = "2026-09-17")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkOut,

            @RequestParam(required = false) String type,
            @RequestParam(required = false) @PositiveOrZero BigDecimal minPrice,
            @RequestParam(required = false) @PositiveOrZero BigDecimal maxPrice,
            @RequestParam(required = false) @Min(1) Integer guests,
            @Parameter(description = "Free-text match on room, hotel name or city")
            @RequestParam(required = false) String q) {

        return ResponseEntity.ok(bookingService.searchAvailable(
                hotelId, city, checkIn, checkOut, type, minPrice, maxPrice, guests, q));
    }

    @Operation(summary = "Suggest hotels in a city that genuinely have rooms free",
            description = """
                    Public. **The destination search.** Give it a city and dates and it returns
                    the properties you can actually book, best-rated first.

                    Neither service can answer this alone: room-service knows the properties
                    and their rooms but nothing about reservations, while this service knows
                    reservations but holds no catalogue. So it reads both from room-service,
                    subtracts its own overlapping bookings, and folds the result up per hotel.

                    `cheapestPricePerNight` is the cheapest **available** room — not the
                    property's headline rate, which may belong to a room already taken for
                    your dates. That is the difference between this and
                    `GET /api/hotels?city=…` on room-service, whose `priceFrom` is date-blind.

                    Hotels with nothing free are omitted rather than listed as unavailable.
                    Omit both dates to see every listed property in the city.
                    """)
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Suggested properties"),
            @ApiResponse(responseCode = "400", description = "City missing, or only one date given"),
            @ApiResponse(responseCode = "503", description = "Room catalog temporarily unreachable")
    })
    @GetMapping("/search/hotels")
    public ResponseEntity<List<AvailableHotelResponse>> suggestHotels(
            @Parameter(description = "Destination, exactly as returned by /api/cities",
                    example = "Lisbon", required = true)
            @RequestParam String city,

            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkIn,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkOut,

            @Parameter(description = "Only count rooms sleeping at least this many")
            @RequestParam(required = false) @Min(1) Integer guests,
            @Parameter(description = "Only count rooms at or below this nightly rate")
            @RequestParam(required = false) @PositiveOrZero BigDecimal maxPrice,
            @Parameter(description = "Minimum property star rating, 1-5")
            @RequestParam(required = false) @Min(1) @Max(5) Integer minStars) {

        return ResponseEntity.ok(
                bookingService.suggestHotels(city, checkIn, checkOut, guests, maxPrice, minStars));
    }

    @Operation(summary = "Check one room against one date range",
            description = "Public. Used by the room detail page to enable or disable the "
                    + "booking button before the guest submits.")
    @GetMapping("/availability")
    public ResponseEntity<Map<String, Object>> checkAvailability(
            @RequestParam Long roomId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkIn,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkOut) {

        boolean available = bookingService.isAvailable(roomId, checkIn, checkOut);
        return ResponseEntity.ok(Map.of(
                "roomId", roomId,
                "checkIn", checkIn,
                "checkOut", checkOut,
                "available", available));
    }

    // ── Guest actions ─────────────────────────────────────────────────────────────

    @Operation(summary = "Book a room",
            security = @SecurityRequirement(name = "bearerAuth"),
            description = """
                    Creates a CONFIRMED reservation for the caller identified by the token.

                    Total price is computed server-side as `pricePerNight × nights`; any
                    amount sent by the client is ignored. Availability is re-verified
                    inside the transaction, so a room that was free on the search screen
                    can still be refused here with a 409.
                    """)
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Booking confirmed"),
            @ApiResponse(responseCode = "400", description = "Invalid dates or stay too long"),
            @ApiResponse(responseCode = "401", description = "Missing or invalid token"),
            @ApiResponse(responseCode = "404", description = "No such room"),
            @ApiResponse(responseCode = "409", description = "Dates clash with an existing booking"),
            @ApiResponse(responseCode = "503", description = "Room catalog temporarily unreachable")
    })
    @PostMapping
    public ResponseEntity<BookingResponse> create(
            @Valid @RequestBody BookingRequest request,
            @AuthenticationPrincipal AuthenticatedUser principal) {

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(bookingService.create(request, principal));
    }

    @Operation(summary = "List the caller's own bookings, newest first",
            security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping("/my")
    public ResponseEntity<List<BookingResponse>> myBookings(
            @AuthenticationPrincipal AuthenticatedUser principal) {
        return ResponseEntity.ok(bookingService.findMyBookings(principal));
    }

    @Operation(summary = "Fetch one booking",
            security = @SecurityRequirement(name = "bearerAuth"),
            description = "Customers can only read their own; anyone else's id returns 404 "
                    + "rather than 403, so booking ids cannot be enumerated.")
    @GetMapping("/{id}")
    public ResponseEntity<BookingResponse> findById(
            @PathVariable Long id,
            @AuthenticationPrincipal AuthenticatedUser principal) {
        return ResponseEntity.ok(bookingService.findById(id, principal));
    }

    @Operation(summary = "Cancel a booking",
            security = @SecurityRequirement(name = "bearerAuth"),
            description = """
                    Customers may cancel their own bookings; admins may cancel any.

                    The record is kept with status CANCELLED rather than deleted, so the
                    nights become bookable again immediately while the history remains.
                    A stay that has already begun cannot be cancelled.
                    """)
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Cancelled"),
            @ApiResponse(responseCode = "400", description = "Already cancelled, or stay already started"),
            @ApiResponse(responseCode = "404", description = "No such booking for this caller")
    })
    @PatchMapping("/{id}/cancel")
    public ResponseEntity<BookingResponse> cancel(
            @PathVariable Long id,
            @AuthenticationPrincipal AuthenticatedUser principal) {
        return ResponseEntity.ok(bookingService.cancel(id, principal));
    }

    // ── Admin ─────────────────────────────────────────────────────────────────────

    @Operation(summary = "List every booking across all guests",
            security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<BookingResponse>> findAll(
            @Parameter(description = "Optional status filter")
            @RequestParam(required = false) BookingStatus status) {
        return ResponseEntity.ok(bookingService.findAll(status));
    }

    @Operation(summary = "Reservation aggregates and the bookings-over-time series",
            security = @SecurityRequirement(name = "bearerAuth"),
            description = "Defaults to a window of 15 days back to 30 days ahead.")
    @GetMapping("/stats")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<BookingStatsResponse> stats(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(bookingService.stats(from, to));
    }
}
