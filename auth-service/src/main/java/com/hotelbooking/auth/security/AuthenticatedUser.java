package com.hotelbooking.auth.security;

/**
 * The authenticated principal, reconstructed purely from JWT claims.
 *
 * <p>Deliberately not a JPA entity: resolving the principal must never cost a
 * database round-trip, and the same shape is used by services that own no user table.
 */
public record AuthenticatedUser(Long id, String email, String name, String role) {

    public boolean isAdmin() {
        return "ADMIN".equals(role);
    }
}
