package com.hotelbooking.booking.repository;

import com.hotelbooking.booking.domain.RoomLock;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RoomLockRepository extends JpaRepository<RoomLock, Long> {

    /**
     * Serialises booking attempts for one room.
     *
     * <p>Issues {@code SELECT ... FOR UPDATE} against a row that is known to exist, so
     * the lock is actually granted — the whole point of the {@code room_locks} table.
     * The lock is held until the surrounding transaction commits or rolls back.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select l from RoomLock l where l.roomId = :roomId")
    Optional<RoomLock> findAndLock(@Param("roomId") Long roomId);
}
