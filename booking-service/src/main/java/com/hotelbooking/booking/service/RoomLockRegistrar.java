package com.hotelbooking.booking.service;

import com.hotelbooking.booking.repository.RoomLockRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Makes sure a room's lock row exists before anyone tries to lock it.
 *
 * <p>Rooms are created in room-service, which knows nothing about this table, so the row
 * is created lazily on a room's first booking attempt.
 *
 * <p>Deliberately <b>not</b> {@code @Transactional}. The insert runs in its own
 * transaction inside {@link RoomLockInserter}, and this method sits outside that boundary
 * so a lost insert race can be caught and ignored without poisoning any transaction. It
 * must also commit before the caller tries to lock the row — a row inserted inside the
 * booking transaction would be invisible to every competing thread until that transaction
 * committed, which is precisely the race the row exists to prevent.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RoomLockRegistrar {

    private final RoomLockRepository roomLockRepository;
    private final RoomLockInserter roomLockInserter;

    public void ensureExists(Long roomId) {
        if (roomLockRepository.existsById(roomId)) {
            return;
        }
        try {
            roomLockInserter.insert(roomId);
            log.debug("Created lock row for room {}", roomId);
        } catch (RuntimeException ex) {
            // The expected failure is a duplicate key: another request inserted the same
            // row between the check above and this insert. Both callers wanted the
            // identical outcome, so that is success, not failure.
            //
            // Caught as RuntimeException rather than DataAccessException on purpose —
            // EntityManager.flush() is not covered by Spring's persistence-exception
            // translation, so this arrives as a raw Hibernate ConstraintViolationException.
            // Rather than guess at the type, confirm the benign case by its effect: if the
            // row is now present, the race was harmless. Anything else is a real fault and
            // must not be swallowed.
            if (!roomLockRepository.existsById(roomId)) {
                log.error("Failed to create lock row for room {}", roomId, ex);
                throw ex;
            }
            log.debug("Lock row for room {} was created concurrently", roomId);
        }
    }
}
