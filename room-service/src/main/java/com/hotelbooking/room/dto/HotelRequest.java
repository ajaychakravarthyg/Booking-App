package com.hotelbooking.room.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

@Schema(description = "Admin payload for creating or replacing a hotel")
public record HotelRequest(

        @NotBlank(message = "Hotel name is required")
        @Size(max = 150, message = "Hotel name must be at most 150 characters")
        @Schema(example = "The Riverside Grand")
        String name,

        @NotBlank(message = "City is required")
        @Size(max = 100)
        @Schema(example = "Lisbon", description = "Feeds the destination autocomplete, so "
                + "spelling matters — reuse an existing city's exact spelling to group "
                + "properties together.")
        String city,

        @NotBlank(message = "Country is required")
        @Size(max = 100)
        @Schema(example = "Portugal")
        String country,

        @Size(max = 250)
        @Schema(example = "12 Rua do Comércio")
        String address,

        @DecimalMin(value = "-90.0", message = "Latitude must be between -90 and 90")
        @DecimalMax(value = "90.0", message = "Latitude must be between -90 and 90")
        @Schema(example = "38.7071", description = "WGS84. Optional, but a property without "
                + "coordinates cannot appear in 'near me' results.")
        BigDecimal latitude,

        @DecimalMin(value = "-180.0", message = "Longitude must be between -180 and 180")
        @DecimalMax(value = "180.0", message = "Longitude must be between -180 and 180")
        @Schema(example = "-9.1355")
        BigDecimal longitude,

        @Size(max = 2000)
        String description,

        @Min(value = 1, message = "Star rating must be between 1 and 5")
        @Max(value = 5, message = "Star rating must be between 1 and 5")
        @Schema(example = "4", description = "Optional — omit for an unrated property")
        Integer starRating,

        @Size(max = 500)
        String imageUrl,

        @Schema(example = "[\"Pool\",\"Spa\",\"Airport shuttle\"]",
                description = "Property-level facilities, distinct from a room's amenities")
        List<@Size(max = 40) String> amenities,

        @NotNull(message = "Active flag is required")
        @Schema(description = "False de-lists the property and hides every room in it, "
                + "without touching each room's own availability flag.", example = "true")
        Boolean active
) {}
