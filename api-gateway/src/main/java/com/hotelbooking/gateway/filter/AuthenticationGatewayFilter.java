package com.hotelbooking.gateway.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hotelbooking.gateway.security.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Authenticates every request crossing the perimeter and re-writes the identity headers.
 *
 * <p>Two rules, and the second is the one that matters most:
 *
 * <ol>
 *   <li>If an {@code Authorization: Bearer} header is present it <b>must</b> verify.
 *       An invalid or expired token is rejected here with 401 and never reaches a service.
 *       A request with <i>no</i> token is forwarded unauthenticated, so each service can
 *       decide for itself whether the endpoint is public.</li>
 *
 *   <li><b>Inbound {@code X-User-*} headers are always stripped</b>, whether or not a
 *       token was supplied. Downstream services treat those headers as trusted identity,
 *       so if a client could set them it would simply declare itself
 *       {@code X-User-Role: ADMIN} and walk straight past every authorization check. They
 *       are removed unconditionally and re-added only from verified claims.</li>
 * </ol>
 *
 * <p>Note that the services also validate the JWT themselves rather than trusting these
 * headers blindly — on a free host each service gets its own public URL, so the gateway
 * cannot be assumed to be the only way in.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AuthenticationGatewayFilter implements GlobalFilter, Ordered {

    public static final String HEADER_USER_ID = "X-User-Id";
    public static final String HEADER_USER_EMAIL = "X-User-Email";
    public static final String HEADER_USER_NAME = "X-User-Name";
    public static final String HEADER_USER_ROLE = "X-User-Role";

    private static final String BEARER_PREFIX = "Bearer ";
    private static final List<String> SPOOFABLE_HEADERS =
            List.of(HEADER_USER_ID, HEADER_USER_EMAIL, HEADER_USER_NAME, HEADER_USER_ROLE);

    private final JwtService jwtService;
    private final ObjectMapper objectMapper;

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String authHeader = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);

        // No credentials offered: forward with the identity headers scrubbed and let the
        // target service decide whether this route is public.
        if (authHeader == null || !authHeader.startsWith(BEARER_PREFIX)) {
            return chain.filter(exchange.mutate().request(stripIdentityHeaders(request)).build());
        }

        String token = authHeader.substring(BEARER_PREFIX.length()).trim();
        Optional<JwtService.GatewayPrincipal> principal = jwtService.parse(token);

        if (principal.isEmpty()) {
            log.debug("Rejecting {} {} — invalid or expired token",
                    request.getMethod(), request.getPath());
            return unauthorized(exchange, "Your session is invalid or has expired. Please sign in again.");
        }

        JwtService.GatewayPrincipal user = principal.get();
        ServerHttpRequest mutated = request.mutate()
                .headers(headers -> {
                    SPOOFABLE_HEADERS.forEach(headers::remove);
                    headers.add(HEADER_USER_ID, String.valueOf(user.id()));
                    headers.add(HEADER_USER_EMAIL, nullSafe(user.email()));
                    headers.add(HEADER_USER_NAME, nullSafe(user.name()));
                    headers.add(HEADER_USER_ROLE, nullSafe(user.role()));
                })
                .build();

        return chain.filter(exchange.mutate().request(mutated).build());
    }

    private ServerHttpRequest stripIdentityHeaders(ServerHttpRequest request) {
        return request.mutate()
                .headers(headers -> SPOOFABLE_HEADERS.forEach(headers::remove))
                .build();
    }

    private Mono<Void> unauthorized(ServerWebExchange exchange, String message) {
        var response = exchange.getResponse();
        response.setStatusCode(HttpStatus.UNAUTHORIZED);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);

        // Same error envelope the services emit, so the client has one shape to handle.
        Map<String, Object> body = Map.of(
                "timestamp", Instant.now().toString(),
                "status", HttpStatus.UNAUTHORIZED.value(),
                "error", HttpStatus.UNAUTHORIZED.getReasonPhrase(),
                "message", message,
                "path", exchange.getRequest().getPath().value());

        try {
            DataBuffer buffer = response.bufferFactory().wrap(objectMapper.writeValueAsBytes(body));
            return response.writeWith(Mono.just(buffer));
        } catch (Exception ex) {
            log.error("Could not serialise the 401 response body", ex);
            return response.setComplete();
        }
    }

    private String nullSafe(String value) {
        return value == null ? "" : value;
    }

    @Override
    public int getOrder() {
        // Ahead of the routing filter so headers are fixed before the request is forwarded.
        return -100;
    }
}
