package com.hotelbooking.booking.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * One row per room, existing only to be locked.
 *
 * <p><b>Why this table exists.</b> Rejecting overlaps needs the check and the insert to
 * be atomic per room. {@code SELECT ... FOR UPDATE} over the bookings themselves cannot
 * deliver that, because row locks can only lock rows that already exist — when a room
 * has no bookings yet, concurrent transactions all read an empty set, all conclude "free"
 * and all insert. That is a phantom-insert race, and it is not theoretical: a load test
 * firing 12 simultaneous identical requests at an unbooked room produced 3 confirmed
 * bookings before this table was introduced.
 *
 * <p>Locking a row that is guaranteed to exist fixes it. Every booking attempt first
 * takes a {@code PESSIMISTIC_WRITE} lock on this room's row, so attempts for the same
 * room queue up and each sees the previous one's committed insert. Different rooms lock
 * different rows and stay fully parallel.
 *
 * <p>Unlike a JVM-level lock this works across replicas, and unlike the PostgreSQL
 * exclusion constraint it works on H2 too — so local development is protected by the
 * same rule as production.
 */
@Entity
@Table(name = "room_locks")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class RoomLock {

    /** The room id from room-service. Assigned, never generated. */
    @Id
    @Column(name = "room_id", nullable = false, updatable = false)
    private Long roomId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public RoomLock(Long roomId) {
        this.roomId = roomId;
        this.createdAt = Instant.now();
    }
}
