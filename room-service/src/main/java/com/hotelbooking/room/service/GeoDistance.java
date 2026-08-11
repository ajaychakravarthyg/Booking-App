package com.hotelbooking.room.service;

import java.math.BigDecimal;

/**
 * Great-circle distance between two WGS84 points.
 *
 * <p><b>Why not just compare latitude/longitude differences.</b> A degree of latitude is
 * ~111km everywhere, but a degree of longitude shrinks with the cosine of the latitude — 111km
 * at the equator, 71km in Lisbon, 48km in Reykjavík. Treating the pair as a flat plane makes
 * "within 50km" mean wildly different things depending on where you are, and gets the ordering
 * of results wrong at high latitudes.
 *
 * <p>Haversine assumes a sphere, so it is off by up to ~0.5% against the true ellipsoid. For
 * "which of our hotels is nearest" that is irrelevant — Vincenty's formula would add
 * complexity to refine a number we round to the nearest kilometre anyway.
 */
public final class GeoDistance {

    /** Mean Earth radius in kilometres (IUGG). */
    private static final double EARTH_RADIUS_KM = 6371.0088;

    private GeoDistance() {
    }

    /**
     * @return distance in kilometres, or null if either point is missing a coordinate
     */
    public static Double kilometresBetween(BigDecimal lat1, BigDecimal lon1,
                                           BigDecimal lat2, BigDecimal lon2) {
        if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
            return null;
        }
        return kilometresBetween(
                lat1.doubleValue(), lon1.doubleValue(), lat2.doubleValue(), lon2.doubleValue());
    }

    public static double kilometresBetween(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double radLat1 = Math.toRadians(lat1);
        double radLat2 = Math.toRadians(lat2);

        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

        // atan2 rather than asin: numerically stable for antipodal points, where the
        // asin form loses precision as `a` approaches 1.
        return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    /**
     * A latitude/longitude box that fully contains the given radius, for cheap SQL prefiltering.
     *
     * <p>The box is always larger than the circle, so it over-selects and never under-selects —
     * exact Haversine then trims the corners. This is what keeps the query index-friendly:
     * without it, finding hotels within 50km means computing a trigonometric distance for every
     * row in the table.
     *
     * <p>The longitude span divides by {@code cos(latitude)} to widen the box as it approaches
     * the poles. Clamped because that cosine tends to zero at the pole, which would otherwise
     * produce an infinite span.
     */
    public static BoundingBox boxAround(double latitude, double longitude, double radiusKm) {
        double latDelta = Math.toDegrees(radiusKm / EARTH_RADIUS_KM);

        double cosLat = Math.cos(Math.toRadians(latitude));
        // Below ~0.01 the box would span the whole globe anyway; clamping avoids a divide
        // that trends to infinity within a few kilometres of the poles.
        double lonDelta = Math.abs(cosLat) < 0.01
                ? 180.0
                : Math.toDegrees(radiusKm / (EARTH_RADIUS_KM * cosLat));

        return new BoundingBox(
                clampLatitude(latitude - latDelta),
                clampLatitude(latitude + latDelta),
                longitude - lonDelta,
                longitude + lonDelta);
    }

    private static double clampLatitude(double value) {
        return Math.max(-90.0, Math.min(90.0, value));
    }

    /**
     * @param minLongitude may fall below -180 and {@code maxLongitude} above 180 when the box
     *        straddles the antimeridian. The repository query compares with plain BETWEEN, so
     *        such a box simply matches nothing on the wrapped side — an acknowledged limitation
     *        that only affects searches within a radius of the Pacific date line.
     */
    public record BoundingBox(double minLatitude, double maxLatitude,
                              double minLongitude, double maxLongitude) {
    }
}
