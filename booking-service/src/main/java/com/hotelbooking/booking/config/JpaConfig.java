package com.hotelbooking.booking.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

/** Enables {@code @CreatedDate} population on {@code Booking}. */
@Configuration
@EnableJpaAuditing
public class JpaConfig {
}
