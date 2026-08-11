package com.hotelbooking.gateway.controller;

import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Where a request lands when its target service is unreachable or its circuit is open.
 *
 * <p>This exists mainly for free-tier hosting. On Render every service sleeps after
 * inactivity and takes tens of seconds to wake, so the first request after a quiet spell
 * genuinely will fail. Without a fallback the client sees an opaque gateway error; with
 * one it gets a clear 503, a {@code Retry-After} hint and an explanation the UI can show
 * verbatim — which turns a confusing failure into an honest "waking up, try again".
 */
@Tag(name = "Fallbacks", description = "Responses served when a downstream service is unavailable")
@RestController
@RequestMapping("/fallback")
public class FallbackController {

    private static final Map<String, String> SERVICE_LABELS = Map.of(
            "auth", "the account service",
            "rooms", "the room catalog",
            "bookings", "the booking service");

    @RequestMapping("/{service}")
    public ResponseEntity<Map<String, Object>> fallback(@PathVariable String service) {
        String label = SERVICE_LABELS.getOrDefault(service, "a required service");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", Instant.now().toString());
        body.put("status", HttpStatus.SERVICE_UNAVAILABLE.value());
        body.put("error", HttpStatus.SERVICE_UNAVAILABLE.getReasonPhrase());
        body.put("message", "Could not reach " + label + ". If this deployment is on a free "
                + "tier the service may be waking from sleep — please retry in about 30 seconds.");
        body.put("path", "/fallback/" + service);
        body.put("retryable", true);

        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .header(HttpHeaders.RETRY_AFTER, "30")
                .contentType(MediaType.APPLICATION_JSON)
                .body(body);
    }
}
