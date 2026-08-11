package com.hotelbooking.room.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

/** Enables {@code @CreatedDate} / {@code @LastModifiedDate} population on {@code Room}. */
@Configuration
@EnableJpaAuditing
public class JpaConfig {
}
