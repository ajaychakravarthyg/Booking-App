package com.hotelbooking.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Aggregates for the admin dashboard. The frontend composes this "
        + "with /api/rooms/stats and /api/bookings/stats — no service reaches across "
        + "another service's schema to build it.")
public record UserStatsResponse(
        long totalUsers,
        long admins,
        long customers
) {}
