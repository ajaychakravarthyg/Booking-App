package com.hotelbooking.auth.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

/** Enables {@code @CreatedDate} population on {@code User}. */
@Configuration
@EnableJpaAuditing
public class JpaConfig {
}
