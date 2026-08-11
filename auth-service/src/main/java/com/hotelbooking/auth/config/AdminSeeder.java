package com.hotelbooking.auth.config;

import com.hotelbooking.auth.domain.Role;
import com.hotelbooking.auth.domain.User;
import com.hotelbooking.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Bootstraps the first administrator so a fresh database is immediately usable.
 *
 * <p>Idempotent: if the address already exists the seeder does nothing, so it is safe
 * on every restart and on a shared database with multiple service replicas.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AdminSeeder implements ApplicationRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.seed.admin.email:admin@hotel.com}")
    private String adminEmail;

    @Value("${app.seed.admin.name:Hotel Administrator}")
    private String adminName;

    @Value("${app.seed.admin.password:Admin@12345}")
    private String adminPassword;

    @Value("${app.seed.enabled:true}")
    private boolean seedEnabled;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!seedEnabled) {
            log.info("Admin seeding disabled (app.seed.enabled=false)");
            return;
        }

        String email = adminEmail.trim().toLowerCase();
        if (userRepository.existsByEmailIgnoreCase(email)) {
            log.info("Admin account {} already present — skipping seed", email);
            return;
        }

        userRepository.save(User.builder()
                .name(adminName)
                .email(email)
                .passwordHash(passwordEncoder.encode(adminPassword))
                .role(Role.ADMIN)
                .enabled(true)
                .build());

        log.info("""

                ┌───────────────────────────────────────────────────────────┐
                │  Seeded administrator account                             │
                │  email    : {}
                │  password : {}
                │  Change ADMIN_PASSWORD before exposing this deployment.    │
                └───────────────────────────────────────────────────────────┘
                """, email, adminPassword);
    }
}
