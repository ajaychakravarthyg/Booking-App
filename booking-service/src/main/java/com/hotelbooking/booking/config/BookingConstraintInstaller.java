package com.hotelbooking.booking.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
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

    /**
     * The schema Hibernate puts our tables in.
     *
     * <p>Must be read from configuration rather than inferred with {@code current_schema()}.
     * {@code hibernate.default_schema} only makes Hibernate *qualify* its own SQL — it does
     * not change the JDBC session's {@code search_path}, which stays at the PostgreSQL
     * default of {@code "$user", public}. So {@code current_schema()} reports {@code public}
     * while the tables actually live in {@code booking_service}, and an unqualified
     * {@code ALTER TABLE bookings} resolves to a table that does not exist.
     */
    @Value("${spring.jpa.properties.hibernate.default_schema:public}")
    private String schema;

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
            if (constraintExists()) {
                log.info("Overlap constraint '{}' already present in schema '{}'",
                        CONSTRAINT_NAME, schema);
                return;
            }

            // The table is schema-qualified deliberately — see the note on the `schema` field.
            // btree_gist lives in `public`, which is on the default search_path, so the gist
            // operator classes resolve without qualification.
            jdbcTemplate.execute("""
                    ALTER TABLE %s.bookings
                    ADD CONSTRAINT %s
                    EXCLUDE USING gist (
                        room_id WITH =,
                        daterange(check_in_date, check_out_date, '[)') WITH &&
                    ) WHERE (status = 'CONFIRMED')
                    """.formatted(quoteIdentifier(schema), CONSTRAINT_NAME));

            log.info("Installed exclusion constraint '{}' on {}.bookings — overlapping "
                    + "confirmed bookings are now rejected by PostgreSQL itself",
                    CONSTRAINT_NAME, schema);

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

    private boolean constraintExists() {
        Integer count = jdbcTemplate.queryForObject("""
                select count(*) from pg_constraint c
                join pg_namespace n on n.oid = c.connamespace
                where c.conname = ? and n.nspname = ?
                """, Integer.class, CONSTRAINT_NAME, schema);
        return count != null && count > 0;
    }

    /**
     * A schema name cannot be a bind parameter in DDL, so it is interpolated — which means
     * it must be quoted and escaped rather than trusted. The value comes from our own
     * configuration, not user input, but interpolating identifiers unescaped is the habit
     * that produces SQL injection the day one of them becomes externally supplied.
     */
    private String quoteIdentifier(String identifier) {
        return '"' + identifier.replace("\"", "\"\"") + '"';
    }
}
