package com.hotelbooking.booking;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.cloud.openfeign.EnableFeignClients;

/**
 * Booking service. Owns the {@code booking_service} schema and every reservation rule:
 * overlap rejection, night counting and price calculation.
 *
 * <p>This is the only service that calls another one at request time — it reads the
 * catalog from room-service to price a booking and to build date-aware availability.
 * The dependency is deliberately one-way (booking → room) so the two services never
 * form a cycle.
 */
@EnableDiscoveryClient
@EnableFeignClients
@SpringBootApplication
public class BookingServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(BookingServiceApplication.class, args);
    }
}
