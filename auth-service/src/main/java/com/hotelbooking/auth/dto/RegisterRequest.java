package com.hotelbooking.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Self-service customer registration payload")
public record RegisterRequest(

        @NotBlank(message = "Name is required")
        @Size(min = 2, max = 120, message = "Name must be between 2 and 120 characters")
        @Schema(example = "Ada Lovelace")
        String name,

        @NotBlank(message = "Email is required")
        @Email(message = "Email must be a valid address")
        @Size(max = 180)
        @Schema(example = "ada@example.com")
        String email,

        @NotBlank(message = "Password is required")
        @Size(min = 8, max = 72, message = "Password must be between 8 and 72 characters")
        @Schema(example = "Str0ngPassw0rd", description = "Hashed with BCrypt before storage")
        String password
) {}
