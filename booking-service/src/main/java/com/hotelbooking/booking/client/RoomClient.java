package com.hotelbooking.booking.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

import java.math.BigDecimal;
import java.util.List;

/**
 * Synchronous client for the room catalog.
 *
 * <p>{@code name = "room-service"} is a logical id resolved through Eureka, so this code
 * never contains a host or port — instances can move, scale or restart freely.
 *
 * <p>Calls are wrapped in a Resilience4j circuit breaker; {@link RoomClientFallbackFactory}
 * decides whether a failure means "no such room" or "catalog is down".
 */
@FeignClient(
        name = "room-service",
        path = "/api/rooms",
        fallbackFactory = RoomClientFallbackFactory.class
)
public interface RoomClient {

    @GetMapping("/{id}")
    RoomView findById(@PathVariable("id") Long id);

    /**
     * Mirrors room-service's catalog filters so the availability search can push them
     * down instead of fetching every room and filtering locally.
     */
    @GetMapping
    List<RoomView> search(@RequestParam(value = "type", required = false) String type,
                          @RequestParam(value = "minPrice", required = false) BigDecimal minPrice,
                          @RequestParam(value = "maxPrice", required = false) BigDecimal maxPrice,
                          @RequestParam(value = "guests", required = false) Integer guests,
                          @RequestParam(value = "q", required = false) String q,
                          @RequestParam(value = "available", required = false) Boolean available);
}
