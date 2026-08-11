package com.hotelbooking.room.repository;

import com.hotelbooking.room.domain.Room;
import com.hotelbooking.room.domain.RoomType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoomRepository extends JpaRepository<Room, Long>, JpaSpecificationExecutor<Room> {

    /**
     * Room numbers are unique per hotel, so both halves are needed to identify one.
     * {@code EntityGraph} pulls the hotel in the same query — every caller renders it.
     */
    @EntityGraph(attributePaths = "hotel")
    Optional<Room> findByHotelIdAndRoomNumberIgnoreCase(Long hotelId, String roomNumber);

    boolean existsByHotelIdAndRoomNumberIgnoreCase(Long hotelId, String roomNumber);

    @EntityGraph(attributePaths = "hotel")
    Optional<Room> findWithHotelById(Long id);

    @EntityGraph(attributePaths = "hotel")
    List<Room> findByHotelIdOrderByPricePerNightAsc(Long hotelId);

    /** Backs the "rooms by type" chart on the admin dashboard. */
    @Query("select r.type, count(r) from Room r group by r.type order by r.type")
    List<Object[]> countGroupedByType();

    long countByAvailable(boolean available);

    long countByType(RoomType type);

    long countByHotelId(Long hotelId);

    /**
     * Price spread for the dashboard summary tiles. Aggregated in the database rather than
     * by loading every row, and coalesced so an empty catalog returns zeros instead of nulls.
     */
    @Query("""
            select coalesce(avg(r.pricePerNight), 0),
                   coalesce(min(r.pricePerNight), 0),
                   coalesce(max(r.pricePerNight), 0)
            from Room r
            """)
    List<Object[]> priceAggregates();

    /**
     * Ids of every room in a city that is currently offerable — the room is in service AND
     * its hotel is listed.
     *
     * <p>booking-service needs exactly this set to work out hotel-level availability, and
     * doing it in one query avoids shipping the whole catalog over the wire.
     */
    @Query("""
            select r.id from Room r
            where r.available = true
              and r.hotel.active = true
              and lower(r.hotel.city) = lower(:city)
            """)
    List<Long> findOfferableRoomIdsInCity(@Param("city") String city);
}
