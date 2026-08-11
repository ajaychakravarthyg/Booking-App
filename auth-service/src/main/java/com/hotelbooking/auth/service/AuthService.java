package com.hotelbooking.auth.service;

import com.hotelbooking.auth.domain.Role;
import com.hotelbooking.auth.domain.User;
import com.hotelbooking.auth.dto.AuthResponse;
import com.hotelbooking.auth.dto.LoginRequest;
import com.hotelbooking.auth.dto.RegisterRequest;
import com.hotelbooking.auth.dto.UserResponse;
import com.hotelbooking.auth.exception.EmailAlreadyUsedException;
import com.hotelbooking.auth.exception.InvalidCredentialsException;
import com.hotelbooking.auth.exception.ResourceNotFoundException;
import com.hotelbooking.auth.repository.UserRepository;
import com.hotelbooking.auth.security.AuthenticatedUser;
import com.hotelbooking.auth.security.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = normalizeEmail(request.email());

        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new EmailAlreadyUsedException(email);
        }

        // Self-registration always produces a CUSTOMER. Accepting a role from the
        // request body would let anyone mint themselves an admin account; promotion is
        // an admin-only operation via UserService.
        User user = userRepository.save(User.builder()
                .name(request.name().trim())
                .email(email)
                .passwordHash(passwordEncoder.encode(request.password()))
                .role(Role.CUSTOMER)
                .enabled(true)
                .build());

        log.info("Registered new customer id={} email={}", user.getId(), user.getEmail());
        return issueToken(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        String email = normalizeEmail(request.email());

        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(InvalidCredentialsException::new);

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            log.debug("Failed login attempt for {}", email);
            throw new InvalidCredentialsException();
        }
        if (!user.isEnabled()) {
            throw new InvalidCredentialsException();
        }

        return issueToken(user);
    }

    /**
     * Re-reads the user so a role change made by an admin is reflected as soon as the
     * client refreshes its profile, rather than only after the old token expires.
     */
    @Transactional(readOnly = true)
    public UserResponse currentUser(AuthenticatedUser principal) {
        return userRepository.findById(principal.id())
                .map(UserResponse::from)
                .orElseThrow(() -> ResourceNotFoundException.user(principal.id()));
    }

    private AuthResponse issueToken(User user) {
        return AuthResponse.of(
                jwtService.generateToken(user),
                jwtService.getExpirationSeconds(),
                UserResponse.from(user));
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase();
    }
}
