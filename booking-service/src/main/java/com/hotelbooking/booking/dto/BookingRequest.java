package com.hotelbooking.booking.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

@Schema(description = """
        A reservation request. The guest is taken from the JWT, never from the body —
        accepting a userId here would let anyone book on someone else's behalf.
        """)
public record BookingRequest(

        @NotNull(message = "Room id is required")
        @Schema(example = "3")
        Long roomId,

        @NotNull(message = "Check-in date is required")
        @FutureOrPresent(message = "Check-in date cannot be in the past")
        @Schema(example = "2026-09-14")
        LocalDate checkInDate,

        @NotNull(message = "Check-out date is required")
        @Future(message = "Check-out date must be in the future")
        @Schema(example = "2026-09-17")
        LocalDate checkOutDate
) {

    /**
     * Cross-field rule that no single-property annotation can express. Returning true
     * when either date is null leaves those failures to {@code @NotNull}, so the client
     * gets one clear message per problem instead of a confusing pile.
     */
    @JsonIgnore
    @Schema(hidden = true)
    @AssertTrue(message = "Check-out date must be after check-in date")
    public boolean isDateOrderValid() {
        return checkInDate == null || checkOutDate == null || checkOutDate.isAfter(checkInDate);
    }
}
