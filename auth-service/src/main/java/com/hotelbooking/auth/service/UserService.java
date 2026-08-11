package com.hotelbooking.auth.service;

import com.hotelbooking.auth.domain.Role;
import com.hotelbooking.auth.domain.User;
import com.hotelbooking.auth.dto.UserResponse;
import com.hotelbooking.auth.dto.UserStatsResponse;
import com.hotelbooking.auth.exception.BadRequestException;
import com.hotelbooking.auth.exception.ResourceNotFoundException;
import com.hotelbooking.auth.repository.UserRepository;
import com.hotelbooking.auth.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Admin-only user administration. */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<UserResponse> findAll() {
        return userRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt")).stream()
                .map(UserResponse::from)
                .toList();
    }

    @Transactional
    public UserResponse updateRole(Long userId, Role newRole, AuthenticatedUser actor) {
        User user = findOrThrow(userId);

        if (user.getRole() == newRole) {
            return UserResponse.from(user);
        }
        // Demoting the final admin would leave the platform with no one able to manage
        // rooms or promote anyone back.
        if (user.getRole() == Role.ADMIN && newRole != Role.ADMIN) {
            guardLastAdmin(userId, actor, "change the role of");
        }

        user.setRole(newRole);
        log.info("Admin {} changed role of user {} to {}", actor.email(), userId, newRole);
        return UserResponse.from(user);
    }

    @Transactional
    public UserResponse setEnabled(Long userId, boolean enabled, AuthenticatedUser actor) {
        User user = findOrThrow(userId);

        if (!enabled) {
            if (user.getId().equals(actor.id())) {
                throw new BadRequestException("You cannot deactivate your own account");
            }
            if (user.getRole() == Role.ADMIN) {
                guardLastAdmin(userId, actor, "deactivate");
            }
        }

        user.setEnabled(enabled);
        log.info("Admin {} set enabled={} on user {}", actor.email(), enabled, userId);
        return UserResponse.from(user);
    }

    @Transactional
    public void delete(Long userId, AuthenticatedUser actor) {
        User user = findOrThrow(userId);

        if (user.getId().equals(actor.id())) {
            throw new BadRequestException("You cannot delete your own account");
        }
        if (user.getRole() == Role.ADMIN) {
            guardLastAdmin(userId, actor, "delete");
        }

        // Bookings live in booking-service and keep a denormalized snapshot of the
        // guest's name and email, so historical reservations stay readable after the
        // account is gone. Prefer deactivation when an audit trail matters.
        userRepository.delete(user);
        log.warn("Admin {} deleted user {} ({})", actor.email(), userId, user.getEmail());
    }

    @Transactional(readOnly = true)
    public UserStatsResponse stats() {
        long admins = userRepository.countByRole(Role.ADMIN);
        long customers = userRepository.countByRole(Role.CUSTOMER);
        return new UserStatsResponse(admins + customers, admins, customers);
    }

    private User findOrThrow(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> ResourceNotFoundException.user(userId));
    }

    private void guardLastAdmin(Long userId, AuthenticatedUser actor, String verb) {
        if (userRepository.countByRole(Role.ADMIN) <= 1) {
            log.warn("Admin {} attempted to {} the last remaining admin (user {})",
                    actor.email(), verb, userId);
            throw new BadRequestException(
                    "Cannot " + verb + " the last remaining administrator");
        }
    }
}
