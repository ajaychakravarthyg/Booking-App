package com.hotelbooking.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

@Schema(description = "Credentials exchanged for a JWT")
public record LoginRequest(

        @NotBlank(message = "Email is required")
        @Email(message = "Email must be a valid address")
        @Schema(example = "admin@hotel.com")
        String email,

        @NotBlank(message = "Password is required")
        @Schema(example = "Admin@12345")
        String password
) {}
