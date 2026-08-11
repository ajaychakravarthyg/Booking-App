package com.hotelbooking.room.dto;

import com.hotelbooking.room.domain.RoomType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

@Schema(description = "Admin payload for creating or replacing a room")
public record RoomRequest(

        @NotBlank(message = "Room number is required")
        @Size(max = 20, message = "Room number must be at most 20 characters")
        @Pattern(regexp = "^[A-Za-z0-9\\-]+$",
                message = "Room number may contain only letters, digits and hyphens")
        @Schema(example = "101")
        String roomNumber,

        @NotNull(message = "Room type is required")
        @Schema(example = "DOUBLE")
        RoomType type,

        @NotNull(message = "Price per night is required")
        @DecimalMin(value = "0.01", message = "Price per night must be greater than zero")
        @DecimalMax(value = "1000000.00", message = "Price per night is unrealistically high")
        @Digits(integer = 8, fraction = 2, message = "Price supports at most 2 decimal places")
        @Schema(example = "149.99")
        BigDecimal pricePerNight,

        @NotNull(message = "Capacity is required")
        @Min(value = 1, message = "Capacity must be at least 1")
        @Max(value = 20, message = "Capacity must be at most 20")
        @Schema(example = "2")
        Integer capacity,

        @Size(max = 2000, message = "Description must be at most 2000 characters")
        String description,

        @Size(max = 500)
        @Schema(example = "https://images.unsplash.com/photo-1611892440504-42a792e24d32")
        String imageUrl,

        @Schema(example = "[\"Wi-Fi\",\"Air conditioning\",\"City view\"]")
        List<@Size(max = 40) String> amenities,

        @NotNull(message = "Availability flag is required")
        @Schema(description = "Master in-service switch. False takes the room off sale "
                + "entirely, regardless of dates.", example = "true")
        Boolean available
) {}
