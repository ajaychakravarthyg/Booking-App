package com.hotelbooking.booking.dto;

import com.hotelbooking.booking.domain.Booking;
import com.hotelbooking.booking.domain.BookingStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Schema(description = "A reservation, including the room and guest details captured when "
        + "it was made")
public record BookingResponse(
        Long id,
        Long userId,
        String userName,
        String userEmail,
        Long roomId,
        String roomNumber,
        String roomType,
        @Schema(description = "Nightly rate at the time of booking — unaffected by later "
                + "catalog price changes")
        BigDecimal pricePerNight,
        LocalDate checkInDate,
        LocalDate checkOutDate,
        int nights,
        BigDecimal totalPrice,
        BookingStatus status,
        Instant createdAt,
        Instant cancelledAt,
        @Schema(description = "True when this booking is still confirmed and has not started yet")
        boolean cancellable
) {
    public static BookingResponse from(Booking booking) {
        return from(booking, LocalDate.now());
    }

    public static BookingResponse from(Booking booking, LocalDate today) {
        boolean cancellable = booking.getStatus() == BookingStatus.CONFIRMED
                && !booking.getCheckInDate().isBefore(today);

        return new BookingResponse(
                booking.getId(),
                booking.getUserId(),
                booking.getUserName(),
                booking.getUserEmail(),
                booking.getRoomId(),
                booking.getRoomNumber(),
                booking.getRoomType(),
                booking.getPricePerNight(),
                booking.getCheckInDate(),
                booking.getCheckOutDate(),
                booking.getNights(),
                booking.getTotalPrice(),
                booking.getStatus(),
                booking.getCreatedAt(),
                booking.getCancelledAt(),
                cancellable);
    }
}
