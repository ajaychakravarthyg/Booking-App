package com.hotelbooking.auth.config;

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
    public OpenAPI authServiceOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("Hotel Booking — Auth Service API")
                        .version("1.0.0")
                        .description("""
                                Identity service for the Hotel Room Booking platform.

                                Owns the `auth_service` schema and is the only issuer of JWTs.
                                Obtain a token from `POST /api/auth/login`, then click
                                **Authorize** and paste it to call protected routes.

                                Seeded admin credentials for local runs are printed to the
                                service log on first startup.
                                """)
                        .contact(new Contact().name("Ajay Chakravarthy")
                                .url("https://github.com/ajaychakravarthyg"))
                        .license(new License().name("MIT")))
                .servers(List.of(
                        new Server().url(publicUrl).description("Via API gateway"),
                        new Server().url("http://localhost:9081").description("Direct (local dev)")))
                .components(new Components().addSecuritySchemes("bearerAuth",
                        new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("Paste the raw JWT — Swagger adds the 'Bearer ' prefix.")));
    }
}
