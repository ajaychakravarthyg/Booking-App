package com.hotelbooking.room.controller;

import com.hotelbooking.room.dto.HotelRequest;
import com.hotelbooking.room.dto.HotelResponse;
import com.hotelbooking.room.dto.RoomResponse;
import com.hotelbooking.room.service.HotelService;
import com.hotelbooking.room.exception.BadRequestException;
import com.hotelbooking.room.service.RoomService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
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

import java.util.List;

@Tag(name = "Hotels", description = "Property catalog. Reads are public; writes are ADMIN-only.")
@RestController
@RequestMapping("/api/hotels")
@RequiredArgsConstructor
public class HotelController {

    private final HotelService hotelService;
    private final RoomService roomService;

    @Operation(summary = "Find hotels, usually by city",
            description = """
                    Public. Highest-rated first.

                    Each result carries `roomCount` and `priceFrom`, but both are
                    **date-blind** — `priceFrom` is the cheapest in-service room, not the
                    cheapest room actually free on your dates. For a date-accurate list of
                    properties with real availability, call
                    `GET /api/bookings/search/hotels` on booking-service.

                    `city` is matched exactly (case-insensitively) rather than as a
                    substring, because it comes from `/api/cities` — a LIKE would make
                    "York" also return New York.

                    Supplying `nearLat` + `nearLng` switches to a **proximity search**: results
                    gain `distanceKm` and come back nearest first, and the attribute filters are
                    not applied. Hotels without coordinates never appear in that mode — an
                    ungeocoded property is unknown, not nearby.
                    """)
    @GetMapping
    public ResponseEntity<List<HotelResponse>> search(
            @Parameter(description = "Exact city name, as returned by /api/cities")
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String country,
            @Parameter(description = "Minimum star rating, 1-5")
            @RequestParam(required = false) @Min(1) @Max(5) Integer minStars,
            @Parameter(description = "Free-text match on hotel name, city, address or facilities")
            @RequestParam(required = false) String q,
            @Parameter(description = "Filter by listed status. Omit for all; guests should "
                    + "pass true.")
            @RequestParam(required = false) Boolean active,

            @Parameter(description = "Latitude to search near. Supply with nearLng to switch to "
                    + "a proximity search — results gain distanceKm and are ordered nearest first.",
                    example = "38.7071")
            @RequestParam(required = false) @DecimalMin("-90.0") @DecimalMax("90.0") Double nearLat,

            @Parameter(description = "Longitude to search near", example = "-9.1355")
            @RequestParam(required = false) @DecimalMin("-180.0") @DecimalMax("180.0") Double nearLng,

            @Parameter(description = "Radius in km for the proximity search")
            @RequestParam(defaultValue = "50") @DecimalMin("0.1") @DecimalMax("20000") double radiusKm) {

        // Proximity search is a different question from attribute filtering, so it takes over
        // rather than being AND-ed on: "hotels near me" and "4-star hotels in Kyoto" have
        // different orderings and different meanings of relevance.
        if (nearLat != null || nearLng != null) {
            if (nearLat == null || nearLng == null) {
                throw new BadRequestException(
                        "Supply both nearLat and nearLng to search by proximity");
            }
            return ResponseEntity.ok(hotelService.findNearby(nearLat, nearLng, radiusKm));
        }

        return ResponseEntity.ok(hotelService.search(city, country, minStars, q, active));
    }

    @Operation(summary = "Fetch one hotel")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Found"),
            @ApiResponse(responseCode = "404", description = "No such hotel")
    })
    @GetMapping("/{id}")
    public ResponseEntity<HotelResponse> findById(@PathVariable Long id) {
        return ResponseEntity.ok(hotelService.findById(id));
    }

    @Operation(summary = "List a hotel's rooms, cheapest first",
            description = "Public. Date-blind — see GET /api/bookings/search for availability.")
    @GetMapping("/{id}/rooms")
    public ResponseEntity<List<RoomResponse>> rooms(@PathVariable Long id) {
        return ResponseEntity.ok(roomService.findByHotel(id));
    }

    @Operation(summary = "Create a hotel", security = @SecurityRequirement(name = "bearerAuth"))
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Created"),
            @ApiResponse(responseCode = "403", description = "Caller is not an ADMIN"),
            @ApiResponse(responseCode = "409", description = "That name already exists in that city")
    })
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<HotelResponse> create(@Valid @RequestBody HotelRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(hotelService.create(request));
    }

    @Operation(summary = "Replace a hotel", security = @SecurityRequirement(name = "bearerAuth"))
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<HotelResponse> update(@PathVariable Long id,
                                                @Valid @RequestBody HotelRequest request) {
        return ResponseEntity.ok(hotelService.update(id, request));
    }

    @Operation(summary = "Delete a hotel and all of its rooms",
            security = @SecurityRequirement(name = "bearerAuth"),
            description = """
                    Prefer setting `active: false`, which de-lists the property and hides
                    every room in it while keeping the records intact.

                    Deleting cascades to the hotel's rooms, since a room cannot exist without
                    a property. Past bookings stay readable because each one snapshots its
                    room, but any *future* booking for those rooms becomes orphaned.
                    """)
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        hotelService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
