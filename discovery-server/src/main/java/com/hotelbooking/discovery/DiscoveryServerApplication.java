package com.hotelbooking.discovery;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.netflix.eureka.server.EnableEurekaServer;

/**
 * Eureka service registry.
 *
 * <p>Every other service registers itself here on startup, which is what lets
 * {@code booking-service} call {@code room-service} by logical name
 * ({@code lb://room-service}) instead of a hard-coded host and port.
 */
@EnableEurekaServer
@SpringBootApplication
public class DiscoveryServerApplication {

    public static void main(String[] args) {
        SpringApplication.run(DiscoveryServerApplication.class, args);
    }
}
