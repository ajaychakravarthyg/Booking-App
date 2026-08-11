package com.hotelbooking.auth.security;

import com.hotelbooking.auth.domain.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;

/**
 * Issues and verifies the platform's access tokens.
 *
 * <p>auth-service is the only issuer; every other service holds the same secret and
 * verifies signatures locally. Claims carry the full identity so downstream services
 * never call back here mid-request.
 */
@Slf4j
@Service
public class JwtService {

    public static final String CLAIM_USER_ID = "uid";
    public static final String CLAIM_NAME = "name";
    public static final String CLAIM_ROLE = "role";

    private final SecretKey signingKey;
    private final Duration tokenTtl;
    private final String issuer;

    public JwtService(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.expiration-seconds:86400}") long expirationSeconds,
            @Value("${app.jwt.issuer:hotel-booking}") String issuer) {

        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            // HS256 needs a 256-bit key. Failing loudly at startup beats issuing
            // tokens signed with a weak, guessable secret.
            throw new IllegalStateException(
                    "app.jwt.secret must be at least 32 characters (256 bits) for HS256; got "
                            + keyBytes.length + ". Set the JWT_SECRET environment variable.");
        }
        this.signingKey = Keys.hmacShaKeyFor(keyBytes);
        this.tokenTtl = Duration.ofSeconds(expirationSeconds);
        this.issuer = issuer;
    }

    public String generateToken(User user) {
        Instant now = Instant.now();
        return Jwts.builder()
                .issuer(issuer)
                .subject(user.getEmail())
                .claim(CLAIM_USER_ID, user.getId())
                .claim(CLAIM_NAME, user.getName())
                .claim(CLAIM_ROLE, user.getRole().name())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(tokenTtl)))
                .signWith(signingKey)
                .compact();
    }

    public long getExpirationSeconds() {
        return tokenTtl.toSeconds();
    }

    /**
     * @return the principal when the token is valid and unexpired, otherwise empty.
     */
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
            // Covers bad signature, malformed token and expiry alike. The reason is
            // logged for operators but never returned to the caller.
            log.debug("Rejected token: {}", ex.getMessage());
            return Optional.empty();
        }
    }
}
