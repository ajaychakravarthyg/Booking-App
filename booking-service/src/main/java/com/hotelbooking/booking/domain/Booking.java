package com.hotelbooking.booking.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * A reservation.
 *
 * <p><b>No JPA relationships.</b> {@code userId} and {@code roomId} are plain columns,
 * not {@code @ManyToOne} associations, because the rows they point at live in other
 * services' schemas. A foreign key across a service boundary would couple the two
 * databases and defeat the point of splitting them.
 *
 * <p>Instead the guest and room details are <b>denormalized at write time</b>. That is
 * not redundancy for its own sake — it is what makes a reservation an immutable record:
 * when an admin later raises the nightly rate or renames a room, historical bookings
 * still show what was actually agreed, and rendering a booking list needs no fan-out
 * calls to the other services.
 */
@Entity
@Table(
        name = "bookings",
        indexes = {
                @Index(name = "idx_bookings_user", columnList = "user_id"),
                // The overlap query filters on exactly these three columns.
                @Index(name = "idx_bookings_room_dates",
                        columnList = "room_id, check_in_date, check_out_date"),
                @Index(name = "idx_bookings_status", columnList = "status")
        }
)
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // ── Guest snapshot (owner lives in auth-service) ──────────────────────────────
    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "user_email", nullable = false, length = 180)
    private String userEmail;

    @Column(name = "user_name", nullable = false, length = 120)
    private String userName;

    // ── Room snapshot (owner lives in room-service) ───────────────────────────────
    @Column(name = "room_id", nullable = false)
    private Long roomId;

    @Column(name = "room_number", nullable = false, length = 20)
    private String roomNumber;

    @Column(name = "room_type", nullable = false, length = 20)
    private String roomType;

    /** The rate at the moment of booking. Later catalog edits must not change it. */
    @Column(name = "price_per_night", nullable = false, precision = 10, scale = 2)
    private BigDecimal pricePerNight;

    // ── Reservation ───────────────────────────────────────────────────────────────
    @Column(name = "check_in_date", nullable = false)
    private LocalDate checkInDate;

    @Column(name = "check_out_date", nullable = false)
    private LocalDate checkOutDate;

    @Column(nullable = false)
    private Integer nights;

    @Column(name = "total_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalPrice;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BookingStatus status;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @Version
    private Long version;
}
