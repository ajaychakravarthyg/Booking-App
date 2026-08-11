package com.hotelbooking.room.config;

import com.hotelbooking.room.security.JwtAuthenticationFilter;
import com.hotelbooking.room.security.RestAccessDeniedHandler;
import com.hotelbooking.room.security.RestAuthenticationEntryPoint;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Browsing the catalog is public — guests must be able to see rooms before signing up.
 * Everything that mutates the catalog is ADMIN-only, enforced both by the path rules
 * here and by {@code @PreAuthorize} on the controller.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final RestAuthenticationEntryPoint authenticationEntryPoint;
    private final RestAccessDeniedHandler accessDeniedHandler;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
                .csrf(csrf -> csrf.disable())
                // CORS belongs to the gateway; duplicating it here would emit two
                // Access-Control-Allow-Origin headers and browsers reject that.
                .cors(cors -> cors.disable())
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // /stats sits under /api/rooms but must stay admin-only, so it is
                        // matched before the blanket public GET rule below.
                        .requestMatchers(HttpMethod.GET, "/api/rooms/stats").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/rooms", "/api/rooms/types", "/api/rooms/*")
                            .permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/rooms").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/rooms/*").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/rooms/*").hasRole("ADMIN")

                        // Destinations and hotels: browsing is public so a visitor can search
                        // a city before signing up; only mutation is restricted.
                        // Both the plain list and the proximity variant. An exact-path matcher
                        // here left /api/cities/nearest falling through to "authenticated",
                        // which 401'd a public endpoint.
                        .requestMatchers(HttpMethod.GET, "/api/cities", "/api/cities/nearest")
                            .permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/hotels", "/api/hotels/*",
                                "/api/hotels/*/rooms").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/hotels").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/hotels/*").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/hotels/*").hasRole("ADMIN")
                        .requestMatchers("/actuator/health/**", "/actuator/info").permitAll()
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                        .anyRequest().authenticated())
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler))
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }
}
