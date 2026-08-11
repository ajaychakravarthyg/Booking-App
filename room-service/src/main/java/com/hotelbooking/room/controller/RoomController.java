package com.hotelbooking.room.controller;

import com.hotelbooking.room.domain.RoomType;
import com.hotelbooking.room.dto.RoomRequest;
import com.hotelbooking.room.dto.RoomResponse;
import com.hotelbooking.room.dto.RoomStatsResponse;
import com.hotelbooking.room.service.RoomService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;

@Tag(name = "Rooms", description = "Room catalog. Reads are public; writes are ADMIN-only.")
@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
public class RoomController {

    private final RoomService roomService;

    @Operation(summary = "Browse rooms across all properties",
            description = """
                    Public. Returns rooms matching the supplied filters, cheapest first. Each
                    result carries its hotel's id, name, city and rating, so a result card
                    needs no second request.

                    Narrow with `hotelId` for one property or `city` for a whole destination.

                    This endpoint does **not** consider dates — a room listed here may still
                    be reserved for the nights you want. For a date-aware list call
                    `GET /api/bookings/search` on booking-service, which starts from this
                    catalog and removes rooms with overlapping reservations.

                    Note `available=true` also excludes rooms belonging to a de-listed hotel:
                    a room is only offerable when its own flag AND its property's are set.
                    """)
    @GetMapping
    public ResponseEntity<List<RoomResponse>> search(
            @Parameter(description = "Restrict to one property")
            @RequestParam(required = false) Long hotelId,
            @Parameter(description = "Every room across every hotel in this city (exact match)")
            @RequestParam(required = false) String city,
            @Parameter(description = "Exact room type") @RequestParam(required = false) RoomType type,
            @Parameter(description = "Minimum nightly rate")
            @RequestParam(required = false) @PositiveOrZero BigDecimal minPrice,
            @Parameter(description = "Maximum nightly rate")
            @RequestParam(required = false) @PositiveOrZero BigDecimal maxPrice,
            @Parameter(description = "Minimum sleeping capacity")
            @RequestParam(required = false) @Min(1) Integer guests,
            @Parameter(description = "Free-text match on room number, description or amenities")
            @RequestParam(required = false) String q,
            @Parameter(description = "Filter by in-service flag. Omit for all rooms; "
                    + "customers should pass true.")
            @RequestParam(required = false) Boolean available) {

        return ResponseEntity.ok(
                roomService.search(hotelId, city, type, minPrice, maxPrice, guests, q, available));
    }

    @Operation(summary = "List the supported room types",
            description = "Public. Drives the type dropdown in the UI without hard-coding "
                    + "the enum in the frontend.")
    @GetMapping("/types")
    public ResponseEntity<List<RoomTypeView>> types() {
        return ResponseEntity.ok(java.util.Arrays.stream(RoomType.values())
                .map(t -> new RoomTypeView(t.name(), t.getLabel(), t.getSuggestedCapacity()))
                .toList());
    }

    @Operation(summary = "Catalog aggregates for the admin dashboard",
            security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping("/stats")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<RoomStatsResponse> stats() {
        return ResponseEntity.ok(roomService.stats());
    }

    @Operation(summary = "Fetch one room")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Found"),
            @ApiResponse(responseCode = "404", description = "No such room")
    })
    @GetMapping("/{id}")
    public ResponseEntity<RoomResponse> findById(@PathVariable Long id) {
        return ResponseEntity.ok(roomService.findById(id));
    }

    @Operation(summary = "Create a room", security = @SecurityRequirement(name = "bearerAuth"))
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Created"),
            @ApiResponse(responseCode = "403", description = "Caller is not an ADMIN"),
            @ApiResponse(responseCode = "409", description = "Room number already taken")
    })
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<RoomResponse> create(@Valid @RequestBody RoomRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(roomService.create(request));
    }

    @Operation(summary = "Replace a room", security = @SecurityRequirement(name = "bearerAuth"),
            description = "Changing the nightly rate does not alter existing bookings — each "
                    + "reservation stores the price it was made at.")
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<RoomResponse> update(@PathVariable Long id,
                                               @Valid @RequestBody RoomRequest request) {
        return ResponseEntity.ok(roomService.update(id, request));
    }

    @Operation(summary = "Delete a room", security = @SecurityRequirement(name = "bearerAuth"),
            description = """
                    Prefer setting `available: false` instead. Deleting removes the room from
                    the catalog permanently; past bookings stay readable because they keep a
                    snapshot of it, but any *future* booking for this room becomes orphaned.
                    """)
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        roomService.delete(id);
        return ResponseEntity.noContent().build();
    }

    /** Lightweight view of the enum for UI dropdowns. */
    public record RoomTypeView(String value, String label, int suggestedCapacity) {}
}
