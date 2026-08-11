package com.hotelbooking.auth.dto;

import com.hotelbooking.auth.domain.Role;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

@Schema(description = "Admin-only role change")
public record UpdateRoleRequest(

        @NotNull(message = "Role is required")
        @Schema(example = "ADMIN", allowableValues = {"ADMIN", "CUSTOMER"})
        Role role
) {}
