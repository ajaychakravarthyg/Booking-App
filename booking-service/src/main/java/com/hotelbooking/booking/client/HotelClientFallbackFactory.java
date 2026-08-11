package com.hotelbooking.booking.client;

import com.hotelbooking.booking.exception.CatalogUnavailableException;
import com.hotelbooking.booking.exception.ResourceNotFoundException;
import feign.FeignException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.openfeign.FallbackFactory;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Same reasoning as {@link RoomClientFallbackFactory}: distinguish "no such hotel" (404)
 * from "the catalog is down" (503), because collapsing them tells a guest their destination
 * does not exist during an outage.
 */
@Slf4j
@Component
public class HotelClientFallbackFactory implements FallbackFactory<HotelClient> {

    @Override
    public HotelClient create(Throwable cause) {
        return new HotelClient() {

            @Override
            public List<HotelView> search(String city, Integer minStars, String q, Boolean active) {
                log.error("room-service unavailable while listing hotels for city '{}'", city, cause);
                // Returning an empty list would render as "no hotels in this city", turning an
                // outage into a confident wrong answer. Fail loudly instead.
                throw new CatalogUnavailableException(
                        "The hotel catalog is temporarily unavailable. Please try again in a moment.");
            }

            @Override
            public HotelView findById(Long id) {
                if (cause instanceof FeignException fe && fe.status() == 404) {
                    throw ResourceNotFoundException.hotel(id);
                }
                log.error("room-service unavailable while loading hotel {}", id, cause);
                throw new CatalogUnavailableException(
                        "The hotel catalog is temporarily unavailable. Please try again in a moment.");
            }
        };
    }
}
