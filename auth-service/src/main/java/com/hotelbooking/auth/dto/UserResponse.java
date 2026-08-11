package com.hotelbooking.auth.dto;

import com.hotelbooking.auth.domain.Role;
import com.hotelbooking.auth.domain.User;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

@Schema(description = "Safe projection of a user — never carries the password hash")
public record UserResponse(
        Long id,
        String name,
        String email,
        Role role,
        boolean enabled,
        Instant createdAt
) {
    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole(),
                user.isEnabled(),
                user.getCreatedAt()
        );
    }
}
