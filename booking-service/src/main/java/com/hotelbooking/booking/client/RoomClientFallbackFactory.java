package com.hotelbooking.booking.client;

import com.hotelbooking.booking.exception.CatalogUnavailableException;
import com.hotelbooking.booking.exception.ResourceNotFoundException;
import feign.FeignException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.openfeign.FallbackFactory;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;

/**
 * Translates a failed catalog call into the right HTTP status for our own caller.
 *
 * <p>A plain {@code fallback} cannot do this: it sees only "the call failed" and would
 * report a missing room and a dead service identically. Using a
 * {@link FallbackFactory} gives access to the cause, so:
 *
 * <ul>
 *   <li>404 from room-service → {@code 404} — the room genuinely does not exist</li>
 *   <li>timeout / connection refused / open circuit → {@code 503} — try again later</li>
 * </ul>
 *
 * Collapsing those two into one status would tell a guest "no such room" during an
 * outage, and send them off to fix a problem that is not theirs.
 */
@Slf4j
@Component
public class RoomClientFallbackFactory implements FallbackFactory<RoomClient> {

    @Override
    public RoomClient create(Throwable cause) {
        return new RoomClient() {

            @Override
            public RoomView findById(Long id) {
                if (isNotFound(cause)) {
                    throw ResourceNotFoundException.room(id);
                }
                log.error("room-service unavailable while loading room {}", id, cause);
                throw new CatalogUnavailableException(
                        "The room catalog is temporarily unavailable. Please try again in a moment.");
            }

            @Override
            public List<RoomView> search(Long hotelId, String city, String type,
                                         BigDecimal minPrice, BigDecimal maxPrice,
                                         Integer guests, String q, Boolean available) {
                log.error("room-service unavailable during availability search", cause);
                // Returning an empty list here would render as "no rooms match your dates",
                // quietly turning an outage into a wrong answer. Fail loudly instead.
                throw new CatalogUnavailableException(
                        "The room catalog is temporarily unavailable. Please try again in a moment.");
            }
        };
    }

    private boolean isNotFound(Throwable cause) {
        return cause instanceof FeignException fe && fe.status() == 404;
    }
}
