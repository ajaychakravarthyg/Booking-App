-- ─────────────────────────────────────────────────────────────────────────────────
-- Schema-per-service layout.
--
-- The three services share one PostgreSQL instance but never one schema. Each is
-- pinned to its own via hibernate.default_schema, so a service physically cannot see
-- another's tables — no accidental join across a service boundary, and no shared table
-- that two services both believe they own.
--
-- One instance rather than three is a deliberate, documented compromise: it fits a
-- single free Neon/Supabase database. The isolation that matters (data ownership) is
-- preserved; what is given up is independent failure and independent scaling of the
-- storage layer. See README > Architecture decisions.
--
-- Run automatically by the postgres image on FIRST INITIALISATION ONLY — files in
-- /docker-entrypoint-initdb.d are skipped if the data volume already exists. After a
-- schema change here, recreate the volume: docker compose down -v
-- ─────────────────────────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS auth_service;
CREATE SCHEMA IF NOT EXISTS room_service;
CREATE SCHEMA IF NOT EXISTS booking_service;

-- Required by booking-service's bookings_no_overlap exclusion constraint, which indexes
-- a scalar (room_id) alongside a daterange in one GiST index. Created here because the
-- extension is database-wide and needs privileges the application user may not have.
-- booking-service also attempts this at startup and degrades gracefully if it fails.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- The application role owns its schemas so Hibernate can create tables in them.
DO $$
BEGIN
    EXECUTE format('GRANT ALL ON SCHEMA auth_service, room_service, booking_service TO %I',
                   current_user);
END
$$;
