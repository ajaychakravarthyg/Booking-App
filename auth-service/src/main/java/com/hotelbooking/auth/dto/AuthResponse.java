package com.hotelbooking.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Issued access token plus the profile it belongs to")
public record AuthResponse(
        @Schema(description = "Signed JWT — send as 'Authorization: Bearer <token>'")
        String token,
        @Schema(example = "Bearer")
        String tokenType,
        @Schema(description = "Token lifetime in seconds", example = "86400")
        long expiresIn,
        UserResponse user
) {
    public static AuthResponse of(String token, long expiresInSeconds, UserResponse user) {
        return new AuthResponse(token, "Bearer", expiresInSeconds, user);
    }
}
