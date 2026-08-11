package com.hotelbooking.room.repository;

import com.hotelbooking.room.domain.Room;
import com.hotelbooking.room.domain.RoomType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoomRepository extends JpaRepository<Room, Long>, JpaSpecificationExecutor<Room> {

    Optional<Room> findByRoomNumberIgnoreCase(String roomNumber);

    boolean existsByRoomNumberIgnoreCase(String roomNumber);

    /** Backs the "rooms by type" chart on the admin dashboard. */
    @Query("select r.type, count(r) from Room r group by r.type order by r.type")
    List<Object[]> countGroupedByType();

    long countByAvailable(boolean available);

    long countByType(RoomType type);

    /**
     * Price spread for the dashboard summary tiles. Aggregated in the database rather
     * than by loading every row, and coalesced so an empty catalog returns zeros
     * instead of nulls.
     */
    @Query("""
            select coalesce(avg(r.pricePerNight), 0),
                   coalesce(min(r.pricePerNight), 0),
                   coalesce(max(r.pricePerNight), 0)
            from Room r
            """)
    List<Object[]> priceAggregates();
}
