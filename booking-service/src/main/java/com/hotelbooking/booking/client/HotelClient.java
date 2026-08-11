package com.hotelbooking.booking.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;

/**
 * Property lookups against room-service.
 *
 * <p>Same target service as {@link RoomClient} but a different base path, which is why it
 * needs an explicit {@code contextId} — two {@code @FeignClient} interfaces sharing a
 * {@code name} otherwise collide when Spring registers their configuration beans.
 */
@FeignClient(
        name = "room-service",
        contextId = "hotelClient",
        path = "/api/hotels",
        fallbackFactory = HotelClientFallbackFactory.class
)
public interface HotelClient {

    @GetMapping
    List<HotelView> search(@RequestParam(value = "city", required = false) String city,
                           @RequestParam(value = "minStars", required = false) Integer minStars,
                           @RequestParam(value = "q", required = false) String q,
                           @RequestParam(value = "active", required = false) Boolean active);

    @GetMapping("/{id}")
    HotelView findById(@PathVariable("id") Long id);
}
