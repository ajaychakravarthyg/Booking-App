package com.hotelbooking.room.config;

import com.hotelbooking.room.domain.Room;
import com.hotelbooking.room.domain.RoomType;
import com.hotelbooking.room.repository.RoomRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

/**
 * Seeds a demo catalog so a fresh deployment has something to browse.
 *
 * <p>Skips entirely once any room exists, so it never fights an admin who has curated
 * the real inventory, and never duplicates rows across restarts.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RoomSeeder implements ApplicationRunner {

    private static final String IMG = "https://images.unsplash.com/photo-";
    private static final String IMG_PARAMS = "?auto=format&fit=crop&w=900&q=80";

    private final RoomRepository roomRepository;

    @Value("${app.seed.enabled:true}")
    private boolean seedEnabled;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!seedEnabled) {
            log.info("Room seeding disabled (app.seed.enabled=false)");
            return;
        }
        long existing = roomRepository.count();
        if (existing > 0) {
            log.info("Catalog already holds {} room(s) — skipping seed", existing);
            return;
        }

        roomRepository.saveAll(sampleRooms());
        log.info("Seeded {} sample rooms", roomRepository.count());
    }

    private List<Room> sampleRooms() {
        return List.of(
                room("101", RoomType.SINGLE, "89.00", 1,
                        "Bright single with a garden outlook, ideal for solo business trips.",
                        "1611892440504-42a792e24d32",
                        "Wi-Fi, Air conditioning, Work desk, Garden view"),
                room("102", RoomType.SINGLE, "95.50", 1,
                        "Corner single on a quiet floor with blackout curtains.",
                        "1631049307264-da0ec9d70304",
                        "Wi-Fi, Air conditioning, Blackout curtains, Coffee machine"),
                room("201", RoomType.DOUBLE, "139.00", 2,
                        "Spacious double with a king bed and a walk-in rain shower.",
                        "1590490360182-c33d57733427",
                        "Wi-Fi, Air conditioning, King bed, Rain shower, Smart TV"),
                room("202", RoomType.DOUBLE, "149.99", 2,
                        "City-facing double with a small balcony and espresso maker.",
                        "1566665797739-1674de7a421a",
                        "Wi-Fi, Balcony, City view, Espresso maker, Smart TV"),
                room("203", RoomType.TWIN, "132.00", 2,
                        "Twin room with two full beds — a good fit for colleagues sharing.",
                        "1560448204-e02f11c3d0e2",
                        "Wi-Fi, Air conditioning, Two full beds, Work desk"),
                room("204", RoomType.TWIN, "128.00", 2,
                        "Quiet twin overlooking the courtyard, away from the lifts.",
                        "1582719478250-c89cae4dc85b",
                        "Wi-Fi, Courtyard view, Two full beds, Mini fridge"),
                room("301", RoomType.DELUXE, "219.00", 3,
                        "Deluxe king with a lounge chair, soaking tub and floor-to-ceiling glass.",
                        "1591088398332-8a7791972843",
                        "Wi-Fi, Soaking tub, Lounge area, Nespresso, Panoramic window"),
                room("302", RoomType.DELUXE, "245.00", 3,
                        "Top-floor deluxe with skyline views and a dedicated workspace.",
                        "1571003123894-1f0594d2b5d9",
                        "Wi-Fi, Skyline view, Workspace, Soaking tub, Smart TV"),
                room("401", RoomType.SUITE, "379.00", 4,
                        "One-bedroom suite with a separate living room and dining table for four.",
                        "1618773928121-c32242e63f39",
                        "Wi-Fi, Separate living room, Dining table, Kitchenette, Two bathrooms"),
                room("402", RoomType.SUITE, "455.00", 4,
                        "Corner panorama suite with a wraparound terrace and butler service.",
                        "1445019980597-93fa8acb246c",
                        "Wi-Fi, Terrace, Panoramic view, Butler service, Kitchenette, Two bathrooms")
        );
    }

    private Room room(String number, RoomType type, String price, int capacity,
                      String description, String photoId, String amenities) {
        return Room.builder()
                .roomNumber(number)
                .type(type)
                .pricePerNight(new BigDecimal(price))
                .capacity(capacity)
                .description(description)
                .imageUrl(IMG + photoId + IMG_PARAMS)
                .amenities(amenities)
                .available(true)
                .build();
    }
}
