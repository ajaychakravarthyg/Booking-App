package com.hotelbooking.auth.controller;

import com.hotelbooking.auth.dto.UpdateRoleRequest;
import com.hotelbooking.auth.dto.UpdateStatusRequest;
import com.hotelbooking.auth.dto.UserResponse;
import com.hotelbooking.auth.dto.UserStatsResponse;
import com.hotelbooking.auth.security.AuthenticatedUser;
import com.hotelbooking.auth.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Every route here is admin-only. The gateway already blocks non-admins from
 * {@code /api/users/**}, and {@code @PreAuthorize} enforces it again locally so the
 * service is not relying on the perimeter alone.
 */
@Tag(name = "User administration", description = "ADMIN-only user management")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/users")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @Operation(summary = "List all users, newest first")
    @GetMapping
    public ResponseEntity<List<UserResponse>> findAll() {
        return ResponseEntity.ok(userService.findAll());
    }

    @Operation(summary = "Aggregate user counts for the admin dashboard")
    @GetMapping("/stats")
    public ResponseEntity<UserStatsResponse> stats() {
        return ResponseEntity.ok(userService.stats());
    }

    @Operation(summary = "Promote or demote a user",
            description = "Refuses to demote the last remaining administrator.")
    @PatchMapping("/{id}/role")
    public ResponseEntity<UserResponse> updateRole(
            @PathVariable Long id,
            @Valid @RequestBody UpdateRoleRequest request,
            @AuthenticationPrincipal AuthenticatedUser principal) {
        return ResponseEntity.ok(userService.updateRole(id, request.role(), principal));
    }

    @Operation(summary = "Activate or deactivate a user",
            description = "A deactivated user keeps their history but can no longer log in.")
    @PatchMapping("/{id}/status")
    public ResponseEntity<UserResponse> updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody UpdateStatusRequest request,
            @AuthenticationPrincipal AuthenticatedUser principal) {
        return ResponseEntity.ok(userService.setEnabled(id, request.enabled(), principal));
    }

    @Operation(summary = "Permanently delete a user")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @PathVariable Long id,
            @AuthenticationPrincipal AuthenticatedUser principal) {
        userService.delete(id, principal);
        return ResponseEntity.noContent().build();
    }
}
