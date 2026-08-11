package com.hotelbooking.room.controller;

import com.hotelbooking.room.dto.CityResponse;
import com.hotelbooking.room.service.HotelService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.List;

@Tag(name = "Destinations", description = "The searchable city list, derived from the hotels")
@RestController
@RequestMapping("/api/cities")
@RequiredArgsConstructor
public class CityController {

    private final HotelService hotelService;

    @Operation(summary = "List bookable destinations",
            description = """
                    Public. Powers the destination autocomplete on the search form, and the
                    "popular destinations" cards.

                    Cities are **derived from the hotels** rather than stored in a lookup
                    table, so this can never offer a destination with nothing in it, and never
                    miss one that was just added. Only cities with at least one *listed*
                    hotel appear — suggesting a city that resolves to an empty results page is
                    worse than not suggesting it.

                    Ordered by hotel count descending, so the biggest destinations surface
                    first when the query is empty.
                    """)
    @GetMapping
    public ResponseEntity<List<CityResponse>> findCities(
            @Parameter(description = "Optional substring filter for typeahead, e.g. 'lis'")
            @RequestParam(required = false) String q) {

        List<CityResponse> cities = hotelService.findCities(q);

        // The destination list changes only when an admin adds a hotel, so a short cache
        // spares the database a query per keystroke across every visitor's typeahead.
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
                .body(cities);
    }

    @Operation(summary = "Destinations nearest to a point",
            description = """
                    Public. Given coordinates — typically from the browser's Geolocation API —
                    returns our destinations ordered by distance.

                    A city's distance is that of its **nearest hotel**, not a city centroid: what
                    matters is how far away the thing you can actually book is.

                    Deliberately **not** radius-filtered. Someone opening the app where this
                    catalogue has nothing should still learn that the closest option is 1,300km
                    away, rather than receive an empty list.

                    Distances are great-circle (Haversine), not travel distance — a road route is
                    always longer.
                    """)
    @GetMapping("/nearest")
    public ResponseEntity<List<CityResponse>> findNearest(
            @Parameter(description = "Latitude, -90 to 90", example = "38.7071", required = true)
            @RequestParam @DecimalMin("-90.0") @DecimalMax("90.0") double lat,

            @Parameter(description = "Longitude, -180 to 180", example = "-9.1355", required = true)
            @RequestParam @DecimalMin("-180.0") @DecimalMax("180.0") double lng,

            @Parameter(description = "Maximum destinations to return")
            @RequestParam(defaultValue = "6") @Min(1) @Max(50) int limit) {

        // Not cached: the response depends on the caller's coordinates, so a shared cache would
        // serve one visitor's nearest cities to the next.
        return ResponseEntity.ok(hotelService.findNearestCities(lat, lng, limit));
    }
}
