package com.hotelbooking.booking.config;

import feign.FeignException;
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import io.github.resilience4j.timelimiter.TimeLimiterConfig;
import org.springframework.cloud.circuitbreaker.resilience4j.Resilience4JCircuitBreakerFactory;
import org.springframework.cloud.circuitbreaker.resilience4j.Resilience4JConfigBuilder;
import org.springframework.cloud.client.circuitbreaker.Customizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * Circuit-breaker tuning for the calls into room-service.
 *
 * <p>The important line is {@code ignoreExceptions(FeignException.NotFound.class)}.
 * A 404 means "that room id does not exist" — a correct answer about bad input, not a
 * sign room-service is unhealthy. Counting 404s as failures would let a crawler hitting
 * missing ids trip the breaker and take down booking for everyone.
 */
@Configuration
public class Resilience4jConfig {

    @Bean
    public Customizer<Resilience4JCircuitBreakerFactory> roomServiceCircuitBreaker() {
        CircuitBreakerConfig circuitBreakerConfig = CircuitBreakerConfig.custom()
                .slidingWindowSize(10)
                // Do not judge health until there is a meaningful sample.
                .minimumNumberOfCalls(5)
                .failureRateThreshold(50f)
                .waitDurationInOpenState(Duration.ofSeconds(10))
                .permittedNumberOfCallsInHalfOpenState(3)
                .automaticTransitionFromOpenToHalfOpenEnabled(true)
                .ignoreExceptions(FeignException.NotFound.class)
                .build();

        TimeLimiterConfig timeLimiterConfig = TimeLimiterConfig.custom()
                // Generous enough to absorb a free-tier cold start on the other service,
                // short enough that a guest is not left waiting indefinitely.
                .timeoutDuration(Duration.ofSeconds(20))
                .build();

        return factory -> factory.configureDefault(id -> new Resilience4JConfigBuilder(id)
                .circuitBreakerConfig(circuitBreakerConfig)
                .timeLimiterConfig(timeLimiterConfig)
                .build());
    }
}
