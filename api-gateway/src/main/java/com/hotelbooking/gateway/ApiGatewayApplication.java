package com.hotelbooking.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

/**
 * The single public entry point. The React app knows this address and nothing else.
 *
 * <p>Responsibilities are deliberately narrow:
 * <ul>
 *   <li><b>Routing</b> — maps URL prefixes onto logical service ids resolved via Eureka.</li>
 *   <li><b>Authentication</b> — verifies the JWT signature and expiry once, at the edge.</li>
 *   <li><b>Identity propagation</b> — forwards the caller as {@code X-User-*} headers.</li>
 *   <li><b>CORS</b> — the only place browser origins are configured.</li>
 * </ul>
 *
 * <p><b>Authorization is not here.</b> Deciding which roles may reach which endpoint stays
 * with the service that owns the endpoint. Mirroring that matrix in the gateway would
 * create two sources of truth that drift apart the moment someone adds a route — and the
 * gateway's copy failing open is far worse than failing closed.
 */
@EnableDiscoveryClient
@SpringBootApplication
public class ApiGatewayApplication {

    public static void main(String[] args) {
        SpringApplication.run(ApiGatewayApplication.class, args);
    }
}
