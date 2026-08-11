package com.hotelbooking.auth;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

/**
 * Identity service. Owns the {@code auth_service} schema and is the only service
 * permitted to read or write user rows.
 *
 * <p>It is also the sole issuer of JWTs. Other services never call back here to
 * resolve a user: everything they need (id, name, email, role) travels inside the
 * token claims, which keeps the request path free of a synchronous auth hop.
 */
@EnableDiscoveryClient
@SpringBootApplication
public class AuthServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(AuthServiceApplication.class, args);
    }
}
