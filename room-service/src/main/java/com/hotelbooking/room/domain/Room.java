package com.hotelbooking.room.domain;

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
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(
        name = "rooms",
        indexes = {
                @Index(name = "idx_rooms_room_number", columnList = "room_number", unique = true),
                @Index(name = "idx_rooms_type", columnList = "type"),
                @Index(name = "idx_rooms_price", columnList = "price_per_night")
        }
)
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Room {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "room_number", nullable = false, unique = true, length = 20)
    private String roomNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RoomType type;

    /**
     * BigDecimal, not double: binary floating point cannot represent most decimal
     * money values exactly, and the error compounds once multiplied by night count.
     */
    @Column(name = "price_per_night", nullable = false, precision = 10, scale = 2)
    private BigDecimal pricePerNight;

    @Column(nullable = false)
    private Integer capacity;

    @Column(length = 2000)
    private String description;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    /** Comma-separated for portability; the DTO layer splits it into a list. */
    @Column(length = 500)
    private String amenities;

    /**
     * Admin master switch — "this room is in service at all".
     *
     * <p>Not the same thing as being free on a given date: a bookable room is
     * {@code available == true} AND has no overlapping reservation. Only
     * booking-service can answer the second half.
     */
    @Column(nullable = false)
    private boolean available;

    /**
     * Guards against two admins editing the same room concurrently — the second
     * write fails with an optimistic-lock error instead of silently winning.
     */
    @Version
    private Long version;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;
}
