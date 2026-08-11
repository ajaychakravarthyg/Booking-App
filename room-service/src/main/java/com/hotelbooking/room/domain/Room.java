package com.hotelbooking.room.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
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
        // Room numbers are unique WITHIN a hotel, not globally — every property in the
        // world has a room 101. A global unique index (which this had while the system
        // modelled a single hotel) would reject the second hotel's 101 outright.
        uniqueConstraints = @UniqueConstraint(
                name = "uk_rooms_hotel_room_number", columnNames = {"hotel_id", "room_number"}),
        indexes = {
                @Index(name = "idx_rooms_hotel", columnList = "hotel_id"),
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

    /**
     * The owning property.
     *
     * <p>A real association, unlike the ids in booking-service — hotels and rooms live in
     * the same schema and are owned by the same service, so the database can enforce the
     * relationship. Fetched lazily; the DTO layer pulls only the few hotel fields the
     * client needs, which avoids serialising the whole property behind every room.
     */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotel_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_rooms_hotel"))
    private Hotel hotel;

    /** Unique within the hotel, not globally — see the table constraint above. */
    @Column(name = "room_number", nullable = false, length = 20)
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
