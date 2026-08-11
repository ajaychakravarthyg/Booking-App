package com.hotelbooking.booking.security;

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
 * Verify-only counterpart to auth-service's issuer.
 *
 * <p>booking-service holds the same shared secret but has no user table and never mints a
 * token. Validating locally rather than calling auth-service keeps this service
 * available even when the identity service is down or cold-starting, and takes an
 * network hop off every authenticated request.
 *
 * <p>The gateway already rejects invalid tokens at the perimeter; re-checking here is
 * defence in depth, because on a free host each service also has its own public URL.
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
                            + keyBytes.length + ". Set the JWT_SECRET environment variable to the "
                            + "same value used by auth-service.");
        }
        this.signingKey = Keys.hmacShaKeyFor(keyBytes);
    }

    public Optional<AuthenticatedUser> parse(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(signingKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            Number uid = claims.get(CLAIM_USER_ID, Number.class);
            String role = claims.get(CLAIM_ROLE, String.class);
            if (uid == null || role == null) {
                log.debug("Rejected token: missing uid/role claim");
                return Optional.empty();
            }
            return Optional.of(new AuthenticatedUser(
                    uid.longValue(),
                    claims.getSubject(),
                    claims.get(CLAIM_NAME, String.class),
                    role));
        } catch (JwtException | IllegalArgumentException ex) {
            log.debug("Rejected token: {}", ex.getMessage());
            return Optional.empty();
        }
    }
}
