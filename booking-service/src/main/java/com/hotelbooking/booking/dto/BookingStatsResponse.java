package com.hotelbooking.booking.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Schema(description = "Reservation aggregates for the admin dashboard")
public record BookingStatsResponse(
        long totalBookings,
        long confirmedBookings,
        long cancelledBookings,
        long upcomingArrivals,
        BigDecimal totalRevenue,
        BigDecimal averageBookingValue,
        @Schema(description = "Confirmed arrivals and revenue per check-in date, for the "
                + "requested window. Days with no arrivals are included as zeros so the "
                + "chart shows a continuous time axis rather than skipping gaps.")
        List<DailyPoint> arrivalsPerDay
) {
    @Schema(description = "One point on the bookings-over-time chart")
    public record DailyPoint(LocalDate date, long bookings, BigDecimal revenue) {}
}
