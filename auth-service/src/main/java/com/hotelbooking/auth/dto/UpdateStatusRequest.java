package com.hotelbooking.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

@Schema(description = "Admin-only activation toggle. Preferred over deletion when the "
        + "account's booking history should stay attributable.")
public record UpdateStatusRequest(

        @NotNull(message = "enabled is required")
        Boolean enabled
) {}
