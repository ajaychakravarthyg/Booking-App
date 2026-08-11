package com.hotelbooking.room.controller;

import com.hotelbooking.room.dto.CityResponse;
import com.hotelbooking.room.service.HotelService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
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
}
