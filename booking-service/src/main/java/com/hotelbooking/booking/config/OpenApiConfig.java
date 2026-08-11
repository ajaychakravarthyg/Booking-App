package com.hotelbooking.booking.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class OpenApiConfig {

    @Value("${app.public-url:http://localhost:9080}")
    private String publicUrl;

    @Bean
    public OpenAPI bookingServiceOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("Hotel Booking — Booking Service API")
                        .version("1.0.0")
                        .description("""
                                Reservations for the Hotel Room Booking platform. Owns the
                                `booking_service` schema and every booking rule.

                                **Overlap rule.** A night range is half-open — `[checkIn, checkOut)`.
                                Two bookings clash when `existing.checkIn < new.checkOut`
                                *and* `existing.checkOut > new.checkIn`, so one guest may
                                check out on the same morning another checks in.

                                **Pricing.** `totalPrice = pricePerNight × nights`, computed
                                server-side from the catalog rate and frozen onto the booking.

                                **Cancellation** flips the status to CANCELLED rather than
                                deleting, which releases the dates while keeping the history.
                                """)
                        .contact(new Contact().name("Ajay Chakravarthy")
                                .url("https://github.com/ajaychakravarthyg"))
                        .license(new License().name("MIT")))
                .servers(List.of(
                        new Server().url(publicUrl).description("Via API gateway"),
                        new Server().url("http://localhost:9083").description("Direct (local dev)")))
                .components(new Components().addSecuritySchemes("bearerAuth",
                        new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("Obtain a token from auth-service POST /api/auth/login")));
    }
}
