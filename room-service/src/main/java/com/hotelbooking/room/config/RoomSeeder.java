package com.hotelbooking.room.config;

import com.hotelbooking.room.domain.Hotel;
import com.hotelbooking.room.domain.Room;
import com.hotelbooking.room.domain.RoomType;
import com.hotelbooking.room.repository.HotelRepository;
import com.hotelbooking.room.repository.RoomRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Seeds a demo catalog spanning several cities, so destination search has something real to
 * find. Skips entirely once any hotel exists, so it never fights a curated inventory and
 * never duplicates rows across restarts.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RoomSeeder implements ApplicationRunner {

    private static final String IMG = "https://images.unsplash.com/photo-";
    private static final String HOTEL_PARAMS = "?auto=format&fit=crop&w=1200&q=80";
    private static final String ROOM_PARAMS = "?auto=format&fit=crop&w=900&q=80";

    private final HotelRepository hotelRepository;
    private final RoomRepository roomRepository;

    @Value("${app.seed.enabled:true}")
    private boolean seedEnabled;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!seedEnabled) {
            log.info("Catalog seeding disabled (app.seed.enabled=false)");
            return;
        }
        long existing = hotelRepository.count();
        if (existing > 0) {
            log.info("Catalog already holds {} hotel(s) — skipping seed", existing);
            return;
        }

        List<Hotel> hotels = buildCatalog();
        hotelRepository.saveAll(hotels);

        log.info("Seeded {} hotels across {} cities with {} rooms",
                hotelRepository.count(),
                hotelRepository.countDistinctActiveCities(),
                roomRepository.count());
    }

    /**
     * Eight properties across six cities, with 3–4 rooms each.
     *
     * <p>Two cities deliberately hold more than one hotel, so "hotels in this city" returns a
     * genuine list rather than a single result — otherwise the destination search would look
     * like it worked while never exercising the interesting path.
     */
    private List<Hotel> buildCatalog() {
        List<Hotel> hotels = new ArrayList<>();

        // ── Lisbon (2 hotels) ─────────────────────────────────────────────────────
        hotels.add(hotel("The Riverside Grand", "Lisbon", "Portugal",
                "12 Rua do Comércio, Baixa",
                "38.707500", "-9.136400", 5,
                "A restored 19th-century merchant house on the Tagus waterfront, minutes from "
                        + "Praça do Comércio.",
                "1566073771259-6a8506099945",
                "Rooftop pool, Spa, Fine dining, Airport shuttle, Concierge, Free Wi-Fi",
                List.of(
                        room("101", RoomType.SINGLE, "94.00", 1,
                                "Compact single with a courtyard view and a proper writing desk.",
                                "1611892440504-42a792e24d32",
                                "Wi-Fi, Air conditioning, Work desk, Courtyard view"),
                        room("204", RoomType.DOUBLE, "168.00", 2,
                                "River-facing double with a Juliet balcony and marble bathroom.",
                                "1590490360182-c33d57733427",
                                "Wi-Fi, River view, Balcony, Rain shower, Smart TV"),
                        room("305", RoomType.DELUXE, "265.00", 3,
                                "Deluxe corner room with a soaking tub beneath the window.",
                                "1591088398332-8a7791972843",
                                "Wi-Fi, Soaking tub, River view, Nespresso, Lounge area"),
                        room("501", RoomType.SUITE, "480.00", 4,
                                "Top-floor suite with a wraparound terrace over the river.",
                                "1445019980597-93fa8acb246c",
                                "Wi-Fi, Terrace, River view, Kitchenette, Butler service"))));

        hotels.add(hotel("Alfama Tile House", "Lisbon", "Portugal",
                "40 Beco das Cruzes, Alfama",
                "38.712800", "-9.128200", 3,
                "A tiled guesthouse in the oldest quarter, up the hill from the cathedral.",
                "1631049307264-da0ec9d70304",
                "Free Wi-Fi, Breakfast included, Terrace, Pet friendly",
                List.of(
                        room("1", RoomType.SINGLE, "62.00", 1,
                                "Snug single with original azulejo tiling.",
                                "1595576508898-0ad5c879a061",
                                "Wi-Fi, Fan, Historic tiling"),
                        room("2", RoomType.TWIN, "88.00", 2,
                                "Twin room with two full beds and a view over the rooftops.",
                                "1560448204-e02f11c3d0e2",
                                "Wi-Fi, Rooftop view, Two full beds"),
                        room("3", RoomType.DOUBLE, "105.00", 2,
                                "Double with a small private balcony above the lane.",
                                "1566665797739-1674de7a421a",
                                "Wi-Fi, Balcony, Air conditioning"))));

        // ── Kyoto (2 hotels) ──────────────────────────────────────────────────────
        hotels.add(hotel("Higashiyama Ryokan", "Kyoto", "Japan",
                "3-14 Kodaiji Minamimonzen, Higashiyama",
                "34.996300", "135.782500", 5,
                "A traditional ryokan with cedar baths and a raked stone garden, a short walk "
                        + "from Kiyomizu-dera.",
                "1578469645742-46cae010e5d4",
                "Onsen, Kaiseki dining, Garden, Tea ceremony, Free Wi-Fi",
                List.of(
                        room("Sakura", RoomType.DOUBLE, "285.00", 2,
                                "Tatami room with futon bedding and a private cedar tub.",
                                "1582719478250-c89cae4dc85b",
                                "Wi-Fi, Private onsen, Tatami, Garden view, Yukata"),
                        room("Momiji", RoomType.TWIN, "310.00", 2,
                                "Two-futon room overlooking the maple courtyard.",
                                "1618773928121-c32242e63f39",
                                "Wi-Fi, Garden view, Tatami, Tea set"),
                        room("Matsu", RoomType.SUITE, "620.00", 4,
                                "Corner suite with its own tea room and engawa veranda.",
                                "1571003123894-1f0594d2b5d9",
                                "Wi-Fi, Private onsen, Tea room, Veranda, Kaiseki service"))));

        hotels.add(hotel("Nijo Business Inn", "Kyoto", "Japan",
                "88 Nishinotoin-dori, Nakagyo",
                "35.011600", "135.748000", 3,
                "Straightforward, spotless rooms two minutes from Nijo Castle and the subway.",
                "1554995207-c18c203602cb",
                "Free Wi-Fi, Coin laundry, Vending, 24h reception",
                List.of(
                        room("402", RoomType.SINGLE, "71.00", 1,
                                "Efficient single with blackout blinds and a firm mattress.",
                                "1611892440504-42a792e24d32",
                                "Wi-Fi, Air conditioning, Blackout blinds, Work desk"),
                        room("403", RoomType.SINGLE, "71.00", 1,
                                "Identical single on the quieter side of the building.",
                                "1595576508898-0ad5c879a061",
                                "Wi-Fi, Air conditioning, Blackout blinds"),
                        room("510", RoomType.DOUBLE, "112.00", 2,
                                "Double with a compact desk and city outlook.",
                                "1590490360182-c33d57733427",
                                "Wi-Fi, City view, Air conditioning, Smart TV"))));

        // ── Reykjavík ─────────────────────────────────────────────────────────────
        hotels.add(hotel("Aurora Grand", "Reykjavík", "Iceland",
                "7 Skólavörðustígur",
                "64.145500", "-21.926400", 4,
                "Named for the lights it was built to watch — a glass-roofed lounge, geothermal "
                        + "baths, and blackout rooms for the midnight sun.",
                "1551882547-ff40c63fe5fa",
                "Geothermal baths, Aurora lounge, Sauna, Free Wi-Fi, Tour desk",
                List.of(
                        room("201", RoomType.DOUBLE, "196.00", 2,
                                "Double with a skylight over the bed for winter aurora watching.",
                                "1566665797739-1674de7a421a",
                                "Wi-Fi, Skylight, Heated floors, Blackout curtains"),
                        room("202", RoomType.TWIN, "188.00", 2,
                                "Twin with heated floors and a drying rack for wet gear.",
                                "1560448204-e02f11c3d0e2",
                                "Wi-Fi, Heated floors, Two full beds, Drying rack"),
                        room("301", RoomType.DELUXE, "295.00", 3,
                                "Deluxe with a private hot tub on a screened balcony.",
                                "1591088398332-8a7791972843",
                                "Wi-Fi, Private hot tub, Balcony, Heated floors, Aurora alarm"),
                        room("401", RoomType.SUITE, "540.00", 4,
                                "Glass-walled corner suite with an unobstructed northern view.",
                                "1445019980597-93fa8acb246c",
                                "Wi-Fi, Panoramic glass, Private hot tub, Kitchenette"))));

        // ── Marrakesh ─────────────────────────────────────────────────────────────
        hotels.add(hotel("Riad Dar Zellij", "Marrakesh", "Morocco",
                "21 Derb Sidi Bouloukat, Medina",
                "31.628700", "-7.987800", 4,
                "A courtyard riad with a plunge pool, orange trees and a roof terrace over the "
                        + "medina.",
                "1600585154340-be6161a56a0c",
                "Plunge pool, Roof terrace, Hammam, Breakfast included, Free Wi-Fi",
                List.of(
                        room("Zellij", RoomType.DOUBLE, "128.00", 2,
                                "Double opening straight onto the courtyard colonnade.",
                                "1582719478250-c89cae4dc85b",
                                "Wi-Fi, Courtyard access, Air conditioning, Hand-cut tilework"),
                        room("Safran", RoomType.DELUXE, "185.00", 3,
                                "Deluxe with a carved cedar ceiling and private sitting nook.",
                                "1618773928121-c32242e63f39",
                                "Wi-Fi, Cedar ceiling, Sitting nook, Air conditioning"),
                        room("Terrasse", RoomType.SUITE, "310.00", 4,
                                "Two-room suite with direct steps to the roof terrace.",
                                "1571003123894-1f0594d2b5d9",
                                "Wi-Fi, Terrace access, Two bathrooms, Kitchenette"))));

        // ── Edinburgh ─────────────────────────────────────────────────────────────
        hotels.add(hotel("Old Town Chambers", "Edinburgh", "Scotland",
                "5 Advocate's Close, Royal Mile",
                "55.949900", "-3.190500", 4,
                "Stone-vaulted rooms built into a 17th-century close, halfway down the Royal Mile.",
                "1566073771259-6a8506099945",
                "Free Wi-Fi, Whisky bar, Bike storage, Concierge",
                List.of(
                        room("G2", RoomType.DOUBLE, "152.00", 2,
                                "Vaulted double with exposed stone and a deep window seat.",
                                "1590490360182-c33d57733427",
                                "Wi-Fi, Exposed stone, Window seat, Rain shower"),
                        room("2F", RoomType.TWIN, "146.00", 2,
                                "Twin overlooking the close, with original shutters.",
                                "1560448204-e02f11c3d0e2",
                                "Wi-Fi, Original shutters, Two full beds"),
                        room("4A", RoomType.DELUXE, "228.00", 3,
                                "Top-floor deluxe with a castle glimpse from the bath.",
                                "1591088398332-8a7791972843",
                                "Wi-Fi, Castle view, Freestanding bath, Lounge area"))));

        // ── Cape Town ─────────────────────────────────────────────────────────────
        hotels.add(hotel("Table Bay Lodge", "Cape Town", "South Africa",
                "18 Beach Road, Mouille Point",
                "-33.899700", "18.405600", 4,
                "Sea-facing lodge on the promenade, with Table Mountain filling the back windows.",
                "1554995207-c18c203602cb",
                "Infinity pool, Sea-facing terrace, Gym, Free Wi-Fi, Parking",
                List.of(
                        room("12", RoomType.DOUBLE, "141.00", 2,
                                "Double with a sliding door onto the sea-facing terrace.",
                                "1566665797739-1674de7a421a",
                                "Wi-Fi, Sea view, Terrace, Air conditioning"),
                        room("14", RoomType.TWIN, "138.00", 2,
                                "Twin facing the mountain, quieter than the seaward rooms.",
                                "1582719478250-c89cae4dc85b",
                                "Wi-Fi, Mountain view, Two full beds, Air conditioning"),
                        room("21", RoomType.DELUXE, "212.00", 3,
                                "Upper-floor deluxe with a full-width balcony over the promenade.",
                                "1571003123894-1f0594d2b5d9",
                                "Wi-Fi, Sea view, Full balcony, Espresso machine"),
                        room("PH", RoomType.SUITE, "425.00", 4,
                                "Penthouse suite with sea and mountain aspects and a private braai.",
                                "1445019980597-93fa8acb246c",
                                "Wi-Fi, Sea view, Mountain view, Private braai, Kitchenette"))));

        return hotels;
    }

    private Hotel hotel(String name, String city, String country, String address,
                        String latitude, String longitude,
                        Integer stars, String description, String photoId,
                        String amenities, List<Room> rooms) {

        Hotel hotel = Hotel.builder()
                .name(name)
                .city(city)
                .country(country)
                .address(address)
                // Real coordinates, so the distance maths and the "near me" ordering can be
                // sanity-checked against known city-to-city distances.
                .latitude(new BigDecimal(latitude))
                .longitude(new BigDecimal(longitude))
                .starRating(stars)
                .description(description)
                .imageUrl(IMG + photoId + HOTEL_PARAMS)
                .amenities(amenities)
                .active(true)
                .rooms(new ArrayList<>())
                .build();

        // Wire both sides: the rooms list drives the cascade, and each room needs its
        // non-null hotel_id set before the insert.
        rooms.forEach(room -> {
            room.setHotel(hotel);
            hotel.getRooms().add(room);
        });
        return hotel;
    }

    private Room room(String number, RoomType type, String price, int capacity,
                      String description, String photoId, String amenities) {
        return Room.builder()
                .roomNumber(number)
                .type(type)
                .pricePerNight(new BigDecimal(price))
                .capacity(capacity)
                .description(description)
                .imageUrl(IMG + photoId + ROOM_PARAMS)
                .amenities(amenities)
                .available(true)
                .build();
    }
}
