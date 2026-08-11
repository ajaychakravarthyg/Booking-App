package com.hotelbooking.room.config;

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

    @Value("${app.public-url:http://localhost:8080}")
    private String publicUrl;

    @Bean
    public OpenAPI roomServiceOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("Hotel Booking — Room Service API")
                        .version("1.0.0")
                        .description("""
                                Room catalog for the Hotel Room Booking platform.

                                Owns the `room_service` schema. Reads are public so visitors can
                                browse before registering; create, update and delete require an
                                ADMIN token.

                                This service has no knowledge of bookings. For date-aware
                                availability use `GET /api/bookings/search` on booking-service.
                                """)
                        .contact(new Contact().name("Ajay Chakravarthy")
                                .url("https://github.com/ajaychakravarthyg"))
                        .license(new License().name("MIT")))
                .servers(List.of(
                        new Server().url(publicUrl).description("Via API gateway"),
                        new Server().url("http://localhost:8082").description("Direct (local dev)")))
                .components(new Components().addSecuritySchemes("bearerAuth",
                        new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("Obtain a token from auth-service POST /api/auth/login")));
    }
}
