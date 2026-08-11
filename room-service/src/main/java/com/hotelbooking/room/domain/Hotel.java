package com.hotelbooking.room.domain;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.OneToMany;
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

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * A property. Rooms belong to exactly one.
 *
 * <p><b>Why hotels live in room-service rather than a service of their own.</b> A room has
 * no meaning outside its hotel — you cannot price it, describe it or book it without
 * knowing which property it is in. They are one aggregate, so splitting them would put a
 * network hop in the middle of every "what does this room cost" question and buy no
 * isolation. That makes this service the property catalog, and the {@code hotel_id}
 * relationship below a genuine foreign key rather than a bare id column: both ends live in
 * the same schema, owned by the same service.
 *
 * <p>Contrast {@code Booking.roomId} in booking-service, which is deliberately <i>not</i> a
 * foreign key — that one crosses a service boundary.
 */
@Entity
@Table(
        name = "hotels",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_hotels_name_city", columnNames = {"name", "city"}),
        indexes = {
                @Index(name = "idx_hotels_city", columnList = "city"),
                @Index(name = "idx_hotels_active", columnList = "active")
        }
)
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Hotel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String name;

    /**
     * Stored as a plain column, not a {@code City} entity.
     *
     * <p>A city has no attributes of its own that this product needs and nobody ever edits
     * one, so a lookup table would add a join and an admin screen to maintain data that is
     * already implied by the hotels. The {@code /api/cities} endpoint derives the distinct
     * list straight from this column, which cannot drift out of sync with reality.
     */
    @Column(nullable = false, length = 100)
    private String city;

    @Column(nullable = false, length = 100)
    private String country;

    @Column(length = 250)
    private String address;

    @Column(length = 2000)
    private String description;

    /** 1–5. Nullable because an unrated property is legitimate. */
    @Column(name = "star_rating")
    private Integer starRating;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    /** Comma-separated, matching Room. Property-level facilities: pool, spa, parking. */
    @Column(length = 500)
    private String amenities;

    /**
     * Whether the property is listed at all. Taking a hotel offline hides every room in it
     * from guests without touching each room's own flag.
     */
    @Column(nullable = false)
    private boolean active;

    /**
     * Cascades so deleting a hotel removes its rooms rather than leaving orphans that
     * violate the non-null {@code hotel_id}. Lazy because listing hotels must not drag
     * every room along with it.
     */
    @OneToMany(mappedBy = "hotel", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Room> rooms = new ArrayList<>();

    @Version
    private Long version;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;
}
