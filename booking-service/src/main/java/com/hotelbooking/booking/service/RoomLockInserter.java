package com.hotelbooking.booking.service;

import com.hotelbooking.booking.domain.RoomLock;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Owns nothing but the transaction that inserts a single {@code room_locks} row.
 *
 * <p>Split out from {@link RoomLockRegistrar} so the duplicate-key failure can be caught
 * <em>outside</em> this transaction. Catching it inside would not work: once a statement
 * fails, the transaction is already marked rollback-only, and swallowing the exception
 * just makes the eventual commit throw {@code UnexpectedRollbackException} instead —
 * turning a harmless lost race into a 500.
 */
@Service
@RequiredArgsConstructor
public class RoomLockInserter {

    private final EntityManager entityManager;

    /**
     * @throws org.springframework.dao.DataIntegrityViolationException if another thread
     *         inserted the same row first — expected under concurrency, handled by the caller.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void insert(Long roomId) {
        // persist + flush rather than save(): the id is assigned, so save() would issue a
        // merge (SELECT then UPDATE) and never surface the duplicate-key conflict.
        entityManager.persist(new RoomLock(roomId));
        entityManager.flush();
    }
}
