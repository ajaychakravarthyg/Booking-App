package com.hotelbooking.gateway.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Optional;

/**
 * Verifies tokens at the perimeter using the shared HS256 secret.
 *
 * <p>Signature checking is pure CPU work with no I/O, so it is safe to run directly on a
 * WebFlux event-loop thread — there is nothing here that would block.
 */
@Slf4j
@Service
public class JwtService {

    public static final String CLAIM_USER_ID = "uid";
    public static final String CLAIM_NAME = "name";
    public static final String CLAIM_ROLE = "role";

    private final SecretKey signingKey;

    public JwtService(@Value("${app.jwt.secret}") String secret) {
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            throw new IllegalStateException(
                    "app.jwt.secret must be at least 32 characters (256 bits) for HS256; got "
                            + keyBytes.length + ". Set JWT_SECRET to the same value used by "
                            + "auth-service.");
        }
        this.signingKey = Keys.hmacShaKeyFor(keyBytes);
    }

    public Optional<GatewayPrincipal> parse(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(signingKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            Number uid = claims.get(CLAIM_USER_ID, Number.class);
            String role = claims.get(CLAIM_ROLE, String.class);
            if (uid == null || role == null) {
                return Optional.empty();
            }
            return Optional.of(new GatewayPrincipal(
                    uid.longValue(),
                    claims.getSubject(),
                    claims.get(CLAIM_NAME, String.class),
                    role));
        } catch (JwtException | IllegalArgumentException ex) {
            log.debug("Rejected token at gateway: {}", ex.getMessage());
            return Optional.empty();
        }
    }

    public record GatewayPrincipal(Long id, String email, String name, String role) {}
}
