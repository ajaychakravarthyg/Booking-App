package com.hotelbooking.room;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

/**
 * Room catalog service. Owns the {@code room_service} schema.
 *
 * <p>Deliberately knows nothing about bookings: it answers "what rooms exist and what
 * do they cost", never "is room 12 free next week". Date-range availability is
 * booking-service's business, which keeps the dependency arrow pointing one way
 * (booking → room) and avoids a cycle between the two services.
 */
@EnableDiscoveryClient
@SpringBootApplication
public class RoomServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(RoomServiceApplication.class, args);
    }
}
