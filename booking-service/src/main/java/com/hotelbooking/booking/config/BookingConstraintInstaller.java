package com.hotelbooking.booking.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Installs a PostgreSQL exclusion constraint that makes overlapping confirmed bookings
 * <em>impossible at the storage layer</em>.
 *
 * <p>This is the outermost of three layers of overlap protection, after the application
 * check in {@code ReservationWriter} and the per-room {@code room_locks} row that
 * serialises concurrent attempts. Those two already prevent double booking; what this
 * adds is making a double booking <em>unrepresentable</em> — proof against a future code
 * path that forgets to take the lock, or a manual {@code INSERT} by an operator.
 *
 * <p>The database refuses the offending row outright:
 *
 * <pre>
 *   EXCLUDE USING gist (
 *     room_id WITH =,
 *     daterange(check_in_date, check_out_date, '[)') WITH &amp;&amp;
 *   ) WHERE (status = 'CONFIRMED')
 * </pre>
 *
 * <p>The {@code '[)'} bound is the same half-open interval the JPQL overlap query uses,
 * so checking out and checking in on the same day stays legal. The {@code WHERE} clause
 * limits it to CONFIRMED rows, so cancelling frees the dates.
 *
 * <p>Best-effort by design: H2 has no equivalent feature, and some managed Postgres plans
 * refuse {@code CREATE EXTENSION}. A failure here is logged as a warning rather than
 * aborting startup, because the {@code room_locks} serialisation is portable and remains
 * in force either way.
 */
@Slf4j
@Component
@Order(20)
@RequiredArgsConstructor
public class BookingConstraintInstaller implements ApplicationRunner {

    private static final String CONSTRAINT_NAME = "bookings_no_overlap";

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        String product;
        try {
            product = jdbcTemplate.execute(
                    (org.springframework.jdbc.core.ConnectionCallback<String>) connection ->
                            connection.getMetaData().getDatabaseProductName());
        } catch (Exception ex) {
            log.warn("Could not determine the database product; skipping overlap constraint", ex);
            return;
        }

        if (product == null || !product.toLowerCase().contains("postgresql")) {
            log.info("""
                    Database is {} — skipping the '{}' exclusion constraint (PostgreSQL only).
                    Overlap protection relies on the portable room_locks serialisation in \
                    ReservationWriter, which holds across replicas too.""",
                    product, CONSTRAINT_NAME);
            return;
        }

        try {
            // Needed for a GiST index over a scalar (room_id) alongside a range.
            jdbcTemplate.execute("CREATE EXTENSION IF NOT EXISTS btree_gist");
        } catch (Exception ex) {
            log.warn("Could not enable the btree_gist extension ({}). "
                    + "Skipping the database-level overlap constraint.", ex.getMessage());
            return;
        }

        try {
            String schema = currentSchema();
            if (constraintExists(schema)) {
                log.info("Overlap constraint '{}' already present", CONSTRAINT_NAME);
                return;
            }

            jdbcTemplate.execute("""
                    ALTER TABLE bookings
                    ADD CONSTRAINT %s
                    EXCLUDE USING gist (
                        room_id WITH =,
                        daterange(check_in_date, check_out_date, '[)') WITH &&
                    ) WHERE (status = 'CONFIRMED')
                    """.formatted(CONSTRAINT_NAME));

            log.info("Installed exclusion constraint '{}' — overlapping confirmed bookings "
                    + "are now rejected by PostgreSQL itself", CONSTRAINT_NAME);

        } catch (Exception ex) {
            // The most likely cause is pre-existing overlapping rows created before the
            // constraint was introduced. Report it clearly instead of failing startup.
            log.warn("""
                    Could not install the '{}' exclusion constraint: {}
                    If the table already contains overlapping CONFIRMED bookings, resolve them \
                    and restart. Overlap protection remains in force via the room_locks \
                    serialisation.""", CONSTRAINT_NAME, ex.getMessage());
        }
    }

    private String currentSchema() {
        String schema = jdbcTemplate.queryForObject("select current_schema()", String.class);
        return schema == null ? "public" : schema;
    }

    private boolean constraintExists(String schema) {
        Integer count = jdbcTemplate.queryForObject("""
                select count(*) from pg_constraint c
                join pg_namespace n on n.oid = c.connamespace
                where c.conname = ? and n.nspname = ?
                """, Integer.class, CONSTRAINT_NAME, schema);
        return count != null && count > 0;
    }
}
