package com.hotelbooking.booking.repository;

import com.hotelbooking.booking.domain.Booking;
import com.hotelbooking.booking.domain.BookingStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Repository
public interface BookingRepository extends JpaRepository<Booking, Long> {

    /**
     * The double-booking guard.
     *
     * <p>Two date ranges overlap when each starts before the other ends. Because hotel
     * nights are a half-open interval — you occupy {@code [checkIn, checkOut)} and leave
     * on the check-out morning — the comparisons are strict:
     *
     * <pre>
     *   existing.checkIn &lt; new.checkOut  AND  existing.checkOut &gt; new.checkIn
     * </pre>
     *
     * That lets a guest check out on the 5th while the next checks in on the 5th, which
     * non-strict comparisons would wrongly reject.
     *
     * <p>{@code PESSIMISTIC_WRITE} here is a secondary guard only. It locks the rows it
     * finds, so on its own it cannot stop concurrent <em>first-ever</em> bookings for a
     * room — there are no rows to lock, every transaction reads an empty set, and every
     * one inserts. Serialisation actually comes from the {@code room_locks} row that
     * {@link RoomLockRepository#findAndLock} takes first; on PostgreSQL the
     * {@code bookings_no_overlap} exclusion constraint backs both up at the storage layer.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select b from Booking b
            where b.roomId = :roomId
              and b.status = com.hotelbooking.booking.domain.BookingStatus.CONFIRMED
              and b.checkInDate < :checkOut
              and b.checkOutDate > :checkIn
            """)
    List<Booking> findOverlappingForUpdate(@Param("roomId") Long roomId,
                                           @Param("checkIn") LocalDate checkIn,
                                           @Param("checkOut") LocalDate checkOut);

    /** Read-only overlap probe used by the availability endpoint — takes no locks. */
    @Query("""
            select case when count(b) > 0 then true else false end from Booking b
            where b.roomId = :roomId
              and b.status = com.hotelbooking.booking.domain.BookingStatus.CONFIRMED
              and b.checkInDate < :checkOut
              and b.checkOutDate > :checkIn
            """)
    boolean existsOverlapping(@Param("roomId") Long roomId,
                              @Param("checkIn") LocalDate checkIn,
                              @Param("checkOut") LocalDate checkOut);

    /**
     * Every room with a confirmed reservation touching the range — one query for the
     * whole search, rather than an overlap probe per room.
     */
    @Query("""
            select distinct b.roomId from Booking b
            where b.status = com.hotelbooking.booking.domain.BookingStatus.CONFIRMED
              and b.checkInDate < :checkOut
              and b.checkOutDate > :checkIn
            """)
    Set<Long> findBookedRoomIds(@Param("checkIn") LocalDate checkIn,
                                @Param("checkOut") LocalDate checkOut);

    List<Booking> findByUserId(Long userId, Sort sort);

    Optional<Booking> findByIdAndUserId(Long id, Long userId);

    List<Booking> findByStatus(BookingStatus status, Sort sort);

    long countByStatus(BookingStatus status);

    @Query("""
            select coalesce(sum(b.totalPrice), 0) from Booking b
            where b.status = com.hotelbooking.booking.domain.BookingStatus.CONFIRMED
            """)
    BigDecimal totalConfirmedRevenue();

    @Query("""
            select count(b) from Booking b
            where b.status = com.hotelbooking.booking.domain.BookingStatus.CONFIRMED
              and b.checkInDate >= :from
            """)
    long countUpcomingArrivals(@Param("from") LocalDate from);

    /**
     * Arrivals per day for the dashboard chart. Grouping on a {@code date} column keeps
     * this plain JPQL that runs identically on H2 and PostgreSQL — no dialect-specific
     * date truncation.
     */
    @Query("""
            select b.checkInDate, count(b), coalesce(sum(b.totalPrice), 0) from Booking b
            where b.status = com.hotelbooking.booking.domain.BookingStatus.CONFIRMED
              and b.checkInDate between :from and :to
            group by b.checkInDate
            order by b.checkInDate
            """)
    List<Object[]> arrivalsPerDay(@Param("from") LocalDate from, @Param("to") LocalDate to);
}
