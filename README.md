# 🏨 Aurora Grand — Hotel Room Booking System

A production-style **hotel room booking platform** built as **3 tiers across 5 microservices**, with JWT auth, real availability logic that rejects double-bookings under concurrency, and a responsive React front end.

Built to be read as much as run: the interesting parts are the [availability logic](#-the-interesting-part-preventing-double-bookings) and the [architecture decisions](#-architecture-decisions-and-their-trade-offs), including the ones that are honest compromises.

<p align="left">
  <img alt="Java 21" src="https://img.shields.io/badge/Java-21-orange?logo=openjdk&logoColor=white">
  <img alt="Spring Boot" src="https://img.shields.io/badge/Spring%20Boot-3.4.4-6DB33F?logo=springboot&logoColor=white">
  <img alt="Spring Cloud" src="https://img.shields.io/badge/Spring%20Cloud-2024.0.1-6DB33F?logo=spring&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white">
  <img alt="Docker" src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue">
</p>

---

## 📑 Contents

- [What it does](#-what-it-does)
- [Architecture](#-architecture)
- [The interesting part: preventing double-bookings](#-the-interesting-part-preventing-double-bookings)
- [Tech stack](#-tech-stack)
- [Screenshots](#-screenshots)
- [Running it locally](#-running-it-locally)
- [API reference](#-api-reference)
- [Architecture decisions and their trade-offs](#-architecture-decisions-and-their-trade-offs)
- [Security](#-security)
- [Free deployment guide](#-free-deployment-guide)
- [Project layout](#-project-layout)
- [What I would do next](#-what-i-would-do-next)

---

## ✨ What it does

**Guests**
- Browse the room catalog without signing up
- Search by **real availability** for a date range — rooms already reserved for those nights are filtered out server-side, not greyed out in the UI
- See the stay total (`rate × nights`) before committing
- Book a room, with the price frozen onto the reservation at booking time
- View and cancel their own bookings; cancelling releases the nights immediately

**Administrators**
- Full room CRUD, including taking a room out of service without deleting it
- Every booking across all guests, filterable by status, cancellable on a guest's behalf
- User management: promote/demote, activate/deactivate, delete
- A dashboard with arrivals-over-time, revenue and room-mix charts

**Enforced rules**
- No overlapping confirmed bookings for the same room — verified under concurrency (see below)
- Same-day changeover is legal: one guest checks out on the 14th, the next checks in on the 14th
- `totalPrice` is always computed server-side; a client-supplied amount is ignored
- Stays capped at 30 nights and 365 days ahead
- A stay that has already started cannot be cancelled
- The last remaining administrator cannot be demoted, deactivated or deleted

---

## 🏗 Architecture

Three tiers, with the application tier split into independently deployable services.
**The browser never touches the database.** It only ever speaks to the gateway.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  PRESENTATION TIER                                                           │
│                                                                              │
│    React 18 + Vite  ·  React Router  ·  Axios  ·  Recharts  ·  Tailwind v4   │
│    Composes the admin dashboard from three services, client-side             │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │  HTTPS / JSON  ·  Authorization: Bearer <JWT>
                                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  API GATEWAY  :9080          Spring Cloud Gateway (WebFlux)                  │
│                                                                              │
│   • routes by path prefix onto logical service ids (lb://…)                   │
│   • verifies the JWT once, at the edge                                        │
│   • STRIPS inbound X-User-* headers, re-adds them from verified claims        │
│   • owns the only CORS config in the platform                                 │
│   • circuit breakers + a clear, retryable 503 when a service is cold          │
└───────┬─────────────────────────┬──────────────────────────┬─────────────────┘
        │ /api/auth/**            │ /api/rooms/**            │ /api/bookings/**
        │ /api/users/**           │                          │
        ▼                         ▼                          ▼
┌────────────────┐        ┌────────────────┐        ┌──────────────────────────┐
│ auth-service   │        │ room-service   │        │ booking-service          │
│     :9081      │        │     :9082      │        │        :9083             │
│                │        │                │        │                          │
│ • users        │        │ • room catalog │        │ • reservations           │
│ • BCrypt       │        │ • ADMIN CRUD   │        │ • OVERLAP REJECTION      │
│ • issues JWTs  │        │ • public reads │        │ • price calculation      │
│ • admin user   │        │ • no knowledge │        │ • availability search    │
│   management   │        │   of bookings  │        │ • Feign ──────────┐      │
└───────┬────────┘        └───────┬────────┘        └────────┬──────────┼──────┘
        │                         │  ◄──────────────────────────────────┘
        │                         │                          │   one-way only:
        │                         │                          │   booking → room
        ▼                         ▼                          ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  DATA TIER            PostgreSQL 16  —  one instance, one schema per service │
│                                                                              │
│    auth_service.users        room_service.rooms      booking_service.bookings│
│                                                      booking_service.room_locks│
│                                                                              │
│    No cross-schema joins. No foreign keys across a service boundary.         │
└──────────────────────────────────────────────────────────────────────────────┘

        ┌──────────────────────────────────────────────────┐
        │  discovery-server :9761   Netflix Eureka         │
        │  every service registers; gateway and Feign      │
        │  resolve each other by name, never by host:port  │
        └──────────────────────────────────────────────────┘
```

### Why the dependency arrow points one way

Booking a room needs catalog data (the nightly rate); listing *available* rooms needs both the catalog **and** the reservations. The naive split — room-service asks booking-service "which rooms are taken?" while booking-service asks room-service "what does this room cost?" — creates a **circular dependency** between two services.

Instead, **booking-service owns availability**. It calls room-service for the catalog and subtracts its own overlapping reservations. room-service stays a pure catalog that never calls anyone. So:

- `GET /api/rooms` — the catalog, **date-blind**. Will happily list a room that's taken.
- `GET /api/bookings/search?checkIn=…&checkOut=…` — the catalog **minus** conflicts. What the UI actually uses.

---

## 🔒 The interesting part: preventing double-bookings

Two bookings for the same room conflict when their date ranges overlap. Because a hotel night is a **half-open interval** — you occupy `[checkIn, checkOut)` and leave on the check-out morning — the comparison is strict on both sides:

```sql
existing.check_in_date < new.check_out_date
AND existing.check_out_date > new.check_in_date
AND status = 'CONFIRMED'
```

Strictness is what makes **same-day changeover** work. Non-strict comparisons would wrongly reject a guest arriving on the morning another departs.

Filtering on `status = 'CONFIRMED'` is why **cancelling frees the dates instantly** — the row stays for the audit trail but stops blocking.

### The bug this originally had

A correct overlap query is not enough. The first implementation checked for conflicts with `SELECT … FOR UPDATE` and then inserted. I load-tested it with **12 simultaneous identical requests** for a room with no bookings yet:

```
201 × 3     ← three confirmed bookings for the same room and dates
409 × 9
```

**Row locks can only lock rows that exist.** With no bookings yet, all twelve transactions read an empty result set, all concluded "free", and three won the race to insert. This is a *phantom insert* — no amount of `SELECT FOR UPDATE` closes it.

### The fix: three layers

**1. A lock row that is guaranteed to exist** (`booking_service.room_locks`, one row per room)

Every booking attempt first takes `SELECT … FOR UPDATE` on **that room's** lock row. Attempts for the same room serialise; different rooms stay fully parallel. This is portable — it works identically on H2 and PostgreSQL — and it holds across replicas, which a JVM-level lock would not.

**2. The application overlap check**, re-run inside that transaction. An availability answer from the search screen is already stale by the time the user clicks Book.

**3. A PostgreSQL exclusion constraint** — `bookings_no_overlap`, installed at startup:

```sql
ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
EXCLUDE USING gist (
    room_id WITH =,
    daterange(check_in_date, check_out_date, '[)') WITH &&
) WHERE (status = 'CONFIRMED');
```

This makes a double booking **unrepresentable** — proof against a future code path that forgets the lock, or a manual `INSERT`. Best-effort: H2 has no equivalent and some managed Postgres plans refuse `CREATE EXTENSION btree_gist`, so failure logs a warning rather than aborting startup. Layers 1 and 2 are portable and always active.

### One more resilience gap this exposed

Running the suite against a freshly-restarted stack produced sporadic `503`s on
`/api/bookings/**` while every container reported healthy. The cause was a **stale service
registration**: restarting a container leaves its dead entry in Eureka for up to ~45s, so
round-robin picked a dead instance roughly half the time.

Two fixes, both in the repo:

- **A `Retry` filter on each gateway route**, scoped to *connection-level* failures only
  (`ConnectException` / `IOException`). Because a connection error means the request never
  reached the service, replaying it is safe even for `POST` — it cannot double-create a
  booking. The retry re-runs load balancing, so it lands on a live instance. Retrying on a
  5xx *response* would not be safe, hence the explicitly empty `series`/`statuses`.
- **`registry-fetch-interval-seconds: 5`** (down from the 30s default), so a newly healthy
  instance becomes visible to the gateway quickly.

The smoke test also now waits for the gateway to be able to *route*, not merely for its own
`/actuator/health` to answer — health proves the gateway is up, it does not prove the
registry has converged.

### Verified

87 concurrent attempts across 5 previously-unbooked rooms, plus overlapping-but-different ranges:

| Scenario | Concurrent requests | `201` | `409` | `500` | Rows in DB |
|---|---|---|---|---|---|
| Identical range, room 1 | 12 | **1** | 11 | 0 | 1 |
| Identical range, room 2 | 20 | **1** | 19 | 0 | 1 |
| Identical range, room 4 | 25 | **1** | 24 | 0 | 1 |
| Identical range, room 5 | 30 | **1** | 29 | 0 | 1 |
| Staggered overlapping ranges, room 8 | 15 | **1** | 14 | 0 | 1 |

Zero overlapping pairs, zero unhandled exceptions.

Reproduce it yourself against a running stack:

```bash
make race          # or: ./scripts/race-test.sh http://localhost:9080 20
make smoke         # 43 assertions across the whole API
```

`race-test.sh` picks a random date window each run and cancels what it created on the way
out, so it is safe to run repeatedly — an earlier version reused fixed dates and reported a
false failure on its second run, when the service was in fact correctly returning `409`.

> Two more bugs surfaced while fixing this, both worth recording.
>
> **Swallowing an exception inside its own transaction.** Catching the duplicate-key error *within* the registrar's transaction produced `UnexpectedRollbackException` — once a statement fails, the transaction is already marked rollback-only, so catching the exception merely moves the failure to commit time. The insert had to move into its own bean (`RoomLockInserter`) so the `catch` sits **outside** the transaction boundary. That is why those two classes are separate.
>
> **The exception was not the type I expected.** The `catch` was originally on Spring's `DataAccessException`, but the error arrived as a raw Hibernate `ConstraintViolationException` — `EntityManager.flush()` is not covered by Spring's persistence-exception translation, which only wraps `@Repository` beans. Rather than widen the catch and hope, `RoomLockRegistrar` now confirms the benign case *by its effect* (is the row present?) and rethrows anything else.

### Boundary behaviour

Room 401 is booked **14 → 17 Sept**:

| Requested | Result | Why |
|---|---|---|
| 14 → 17 | `409` | identical |
| 15 → 16 | `409` | fully inside |
| 10 → 20 | `409` | straddles |
| 12 → 15 | `409` | overlaps the start |
| 16 → 19 | `409` | overlaps the end |
| **11 → 14** | **`201`** | departs the morning the other arrives |
| **17 → 19** | **`201`** | arrives the morning the other departs |

---

## 🛠 Tech stack

**Application tier** — Java 21 · Spring Boot 3.4.4 · Spring Cloud 2024.0.1 · Spring Web · Spring Data JPA · Spring Security · Spring Cloud Gateway · Netflix Eureka · OpenFeign · Resilience4j · JJWT 0.12.6 · Bean Validation · Lombok · springdoc-openapi 2.8.6 · Maven

**Data tier** — PostgreSQL 16 (schema per service) · H2 in-memory for zero-setup local dev · Hibernate

**Presentation tier** — React 18 · Vite 6 · React Router 6 · Axios · Recharts · Tailwind CSS v4 · lucide-react

**Ops** — Docker multi-stage builds (non-root, JRE-only runtime) · Docker Compose · Render blueprint · Vercel config

### On the UI

The theme and components are sourced from the **[21st.dev](https://21st.dev)** registry rather than hand-rolled:

- **Theme** — ["Classic blue and dark theme" by @eliaszaki](https://21st.dev/community/themes/classic-blue-and-dark-theme-1785167003696), as CSS custom properties in `src/index.css`. Two deliberate deviations, both for legibility: light-mode `--primary-foreground` was near-black on a blue button (~3:1, fails WCAG AA) and is now white; `--ring` was mint green against a blue primary, so focus rings read as a different brand and were aligned. Dark-mode chart colours were also lifted — the published values are near-invisible on a `#131313` background.
- **Room card** — adapted from ["Hotel Card UI Component" by @uniquesonu](https://21st.dev/@uniquesonu/components/hotel-card-ui-component). Kept the hover lift, image scale and uppercase eyebrow; relaid out vertically for a grid, and the rating block replaced with price and capacity.
- **Button / Card primitives** — the shadcn/ui versions from that component's registry dependencies, converted TSX → JSX with the variant map inlined so the project needs neither `class-variance-authority` nor `@radix-ui/react-slot`.

**Imagery.** Room photography is Unsplash, hotlinked and seeded by `RoomSeeder` — each room
carries its own `imageUrl`, so the catalog stays editable by an admin rather than hard-coded
in the frontend. Page furniture (hero banners) lives in `src/lib/images.js`. The admin area
is image-led rather than a bare CRUD table:

- banner heroes on the dashboard and on each management panel, with a gradient scrim so the
  overlaid text stays legible whatever the photograph
- room thumbnails in the inventory table and beside every reservation
- a **live preview** in the room form — image URLs are arbitrary external links, so showing
  the crop before saving is the only way an admin catches a broken link without publishing
  it to every guest
- `RoomThumb` degrades to an icon tile on load failure, rather than a broken-image glyph

Booking rows get their thumbnail by joining `roomId → imageUrl` from the catalog in the
client. A booking deliberately snapshots only the room's number, type and rate — a photo is
presentation, not contract, so it is not frozen onto the reservation.

---

## 📸 Screenshots

> Placeholders — drop real captures into `docs/screenshots/` with these filenames.

| | |
|---|---|
| **Room search** — date-aware availability<br><img src="docs/screenshots/rooms-light.png" width="420" alt="Room listing, light theme"> | **Dark theme**<br><img src="docs/screenshots/rooms-dark.png" width="420" alt="Room listing, dark theme"> |
| **Room detail + booking**<br><img src="docs/screenshots/room-details.png" width="420" alt="Room detail with booking panel"> | **My bookings**<br><img src="docs/screenshots/my-bookings.png" width="420" alt="My bookings with cancel"> |
| **Admin dashboard** — banner, KPI tiles, charts<br><img src="docs/screenshots/admin-dashboard.png" width="420" alt="Admin dashboard with charts"> | **Room management** — thumbnails + live image preview<br><img src="docs/screenshots/admin-rooms.png" width="420" alt="Admin room management"> |
| **All bookings** — room thumbnails per reservation<br><img src="docs/screenshots/admin-bookings.png" width="420" alt="Admin bookings table"> | **User management**<br><img src="docs/screenshots/admin-users.png" width="420" alt="Admin user management"> |
| **Aggregated Swagger UI**<br><img src="docs/screenshots/swagger.png" width="420" alt="Swagger UI"> | **Eureka registry**<br><img src="docs/screenshots/eureka.png" width="420" alt="Eureka dashboard"> |

---

## 🚀 Running it locally

### Prerequisites

| | Version | Needed for |
|---|---|---|
| Docker + Compose | any recent | the one-command path |
| JDK | 21+ | running services without Docker |
| Maven | 3.9+ | ditto |
| Node.js | 20+ | the frontend |

### Ports

Deliberately **not** the usual 8080/8081/5173. Those collide with almost every other
Spring Boot or Vite project on a developer machine, and this stack binds six ports at
once. Everything sits in a 9xxx block instead, and Postgres is on 5433 so it does not
fight a local 5432 install. Every one is overridable in `.env`.

| Service | Port | |
|---|---|---|
| frontend | **3000** | the app (nginx, via Docker) |
| frontend dev | **5174** | `npm run dev` |
| api-gateway | **9080** | the only port the browser needs |
| auth-service | 9081 | direct access / Swagger |
| room-service | 9082 | direct access / Swagger |
| booking-service | 9083 | direct access / Swagger |
| discovery-server | 9761 | Eureka dashboard |
| postgres | 5433 | host mapping; stays 5432 inside the network |

---

### Option A — Docker Compose (recommended)

Brings up Postgres, Eureka, all four Java services and the frontend.

```bash
git clone https://github.com/ajaychakravarthyg/Booking-App.git
cd Booking-App

cp .env.example .env          # optional; defaults work as-is

docker compose up --build     # first build takes ~5-10 min
```

Then open:

| URL | |
|---|---|
| <http://localhost:3000> | **the app** |
| <http://localhost:9080/swagger-ui.html> | all three APIs in one Swagger UI |
| <http://localhost:9761> | Eureka registry |

Sign in with the seeded admin: **`admin@hotel.com`** / **`Admin@12345`**

Useful:

```bash
docker compose ps                       # health of each service
docker compose logs -f booking-service  # follow one service
docker compose down                     # stop, keep data
docker compose down -v                  # stop and wipe the database
```

> **Startup order is enforced.** Services wait on `service_healthy`, not merely `started` — Hibernate would crash-loop if it connected before Postgres was accepting queries. Expect the first `up` to sit for a minute or so while health checks pass in sequence.

---

### Option B — no Docker

Six terminals. **Zero setup**: each service defaults to its own in-memory H2 database, so no Postgres needed.

```bash
# 1 — service registry (start first)
cd discovery-server && mvn spring-boot:run

# 2 — auth-service        :9081
cd auth-service && mvn spring-boot:run

# 3 — room-service        :9082
cd room-service && mvn spring-boot:run

# 4 — booking-service     :9083
cd booking-service && mvn spring-boot:run

# 5 — api-gateway         :9080
cd api-gateway && mvn spring-boot:run

# 6 — frontend            :5174
cd frontend && npm install && npm run dev
```

Open <http://localhost:5174>. The Vite dev server proxies `/api` to the gateway, so the browser stays same-origin and CORS never applies.

**Skipping Eureka.** Each service also runs standalone:

```bash
EUREKA_ENABLED=false mvn spring-boot:run          # any of the three services
SPRING_PROFILES_ACTIVE=nodiscovery mvn spring-boot:run   # the gateway
```

The gateway's `nodiscovery` profile and booking-service's `h2` profile both carry static `localhost` service addresses as a fallback. Spring consults Eureka first, so these are never reached when the registry is running.

**Against a real Postgres instead of H2:**

```bash
docker run -d --name hotel-pg -p 5432:5432 \
  -e POSTGRES_DB=hotel_booking -e POSTGRES_USER=hotel -e POSTGRES_PASSWORD=hotel \
  -v "$PWD/db/init:/docker-entrypoint-initdb.d:ro" postgres:16-alpine

SPRING_PROFILES_ACTIVE=postgres DB_SCHEMA=auth_service mvn spring-boot:run   # per service
```

---

### Verifying it end to end

```bash
# 1 — register a guest
TOKEN=$(curl -s -X POST http://localhost:9080/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ada Lovelace","email":"ada@example.com","password":"Str0ngPassw0rd"}' \
  | grep -oP '"token":"\K[^"]+')

# 2 — search rooms actually free for those dates (note nights + totalPrice)
curl -s "http://localhost:9080/api/bookings/search?checkIn=2026-09-14&checkOut=2026-09-17"

# 3 — book one
curl -s -X POST http://localhost:9080/api/bookings \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"roomId":9,"checkInDate":"2026-09-14","checkOutDate":"2026-09-17"}'

# 4 — the same nights again → 409, not a second booking
curl -s -X POST http://localhost:9080/api/bookings \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"roomId":9,"checkInDate":"2026-09-15","checkOutDate":"2026-09-16"}'

# 5 — but the changeover day is fine → 201
curl -s -X POST http://localhost:9080/api/bookings \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"roomId":9,"checkInDate":"2026-09-17","checkOutDate":"2026-09-19"}'

# 6 — your bookings
curl -s http://localhost:9080/api/bookings/my -H "Authorization: Bearer $TOKEN"
```

Prove the header-spoofing defence — this returns **401**, not admin data:

```bash
curl -s http://localhost:9080/api/users -H 'X-User-Role: ADMIN' -H 'X-User-Id: 1'
```

---

## 📚 API reference

Interactive docs, all three services in one dropdown: **<http://localhost:9080/swagger-ui.html>**

### auth-service

| Method | Path | Access | |
|---|---|---|---|
| `POST` | `/api/auth/register` | public | Create a CUSTOMER account, returns a JWT. A role in the body is ignored. |
| `POST` | `/api/auth/login` | public | Credentials → JWT |
| `GET` | `/api/auth/me` | authenticated | Re-reads the profile from the database, so a role change lands without waiting for token expiry |
| `GET` | `/api/users` | **ADMIN** | All users |
| `GET` | `/api/users/stats` | **ADMIN** | Counts by role |
| `PATCH` | `/api/users/{id}/role` | **ADMIN** | Promote / demote |
| `PATCH` | `/api/users/{id}/status` | **ADMIN** | Activate / deactivate |
| `DELETE` | `/api/users/{id}` | **ADMIN** | Hard delete |

### room-service

| Method | Path | Access | |
|---|---|---|---|
| `GET` | `/api/rooms` | public | Catalog. Filters: `type` `minPrice` `maxPrice` `guests` `q` `available`. **Date-blind.** |
| `GET` | `/api/rooms/types` | public | The room-type enum, so the UI doesn't hard-code it |
| `GET` | `/api/rooms/{id}` | public | One room |
| `GET` | `/api/rooms/stats` | **ADMIN** | Counts by type, price spread |
| `POST` | `/api/rooms` | **ADMIN** | Create |
| `PUT` | `/api/rooms/{id}` | **ADMIN** | Replace. Does not alter existing bookings' prices. |
| `DELETE` | `/api/rooms/{id}` | **ADMIN** | Delete — prefer `available: false` |

### booking-service

| Method | Path | Access | |
|---|---|---|---|
| `GET` | `/api/bookings/search` | public | **Date-aware availability.** Catalog minus conflicts, with `nights` and `totalPrice`. Both dates or neither. |
| `GET` | `/api/bookings/availability` | public | Is one room free for one range? |
| `POST` | `/api/bookings` | authenticated | Book. Guest taken from the token, never the body. |
| `GET` | `/api/bookings/my` | authenticated | The caller's own bookings |
| `GET` | `/api/bookings/{id}` | authenticated | Own booking; admins see any. Someone else's id returns **404, not 403** — a 403 would confirm it exists. |
| `PATCH` | `/api/bookings/{id}/cancel` | authenticated | Own; admins any |
| `GET` | `/api/bookings` | **ADMIN** | All bookings, `?status=` filter |
| `GET` | `/api/bookings/stats` | **ADMIN** | Totals, revenue, arrivals-per-day series |

### Error envelope

Every service returns the same shape, so the client has one branch to handle:

```json
{
  "timestamp": "2026-08-11T10:56:08.073Z",
  "status": 409,
  "error": "Conflict",
  "message": "Room 401 is already booked for one or more nights between 2026-09-15 and 2026-09-16.",
  "path": "/api/bookings",
  "fieldErrors": { "checkOutDate": "Check-out date must be in the future" }
}
```

| Code | Meaning here |
|---|---|
| `400` | Validation failed — `fieldErrors` names the fields |
| `401` | Missing, malformed or expired token |
| `403` | Authenticated but wrong role |
| `404` | Not found, **or** not yours |
| `409` | Dates clash, duplicate room number, or a concurrent-edit conflict |
| `503` | A downstream service is unreachable or cold — carries `Retry-After` |

---

## 🧭 Architecture decisions and their trade-offs

Where a choice was a genuine compromise, the cost is stated.

### Bookings store denormalized copies of the room and guest

`Booking` holds `roomNumber`, `roomType`, `pricePerNight`, `userName` and `userEmail` — not just ids.

**Why.** A reservation must be an immutable record. When an admin raises a rate or renames a room, historical bookings must still show what was actually agreed. It also means the admin bookings table renders with **no fan-out calls** to the other two services.

**Cost.** The copy can drift from the source of truth. That is correct for price and acceptable for display names; it would be wrong for anything requiring live accuracy.

### No foreign keys across service boundaries

`userId` and `roomId` are plain columns, not `@ManyToOne` associations.

**Why.** A foreign key across a service boundary couples the two databases and forbids deploying or migrating them independently — the point of splitting them.

**Cost.** Referential integrity becomes the application's job. Deleting a room with future bookings orphans them; the API documents deactivation as the safe path and logs a warning. A real system would publish a `RoomDeleted` event over a broker and have booking-service react. There is no broker here, so that gap is documented rather than hidden.

### One PostgreSQL instance, one schema per service

Textbook microservices give each service its own database.

**Why not.** Three managed databases do not fit "deploy this for free". One instance with `auth_service` / `room_service` / `booking_service` schemas fits a single free Neon or Supabase project.

**What is preserved.** Data ownership. Each service is pinned to its schema via `hibernate.default_schema` and physically cannot see another's tables. No cross-schema joins, no shared tables.

**Cost.** Independent failure and independent scaling of the storage layer. One instance going down takes all three services with it. Splitting later is a config change per service, not a code change.

### The gateway authenticates; the services authorize

The gateway verifies the JWT and injects `X-User-*` headers. It does **not** decide which roles may reach which endpoint.

**Why.** Mirroring the authorization matrix in the gateway creates two sources of truth that drift the moment someone adds a route — and the gateway's copy failing *open* is much worse than failing closed. Each service enforces its own rules with `@PreAuthorize` and path matchers.

Each service **also** validates the JWT itself rather than trusting the gateway's headers. On a free host every service gets its own public URL, so the gateway cannot be assumed to be the only way in.

**Cost.** The JWT filter is duplicated across three services (~120 lines each). A shared library would remove that, but it would also mean every service must be built against a published artifact — which breaks "point Render at this subdirectory and deploy". The duplication is the deliberate price of independent deployability.

### `ddl-auto: update`, not Flyway

Hibernate manages the schema; Flyway is listed as optional in the brief and is not wired in.

**Cost.** Real. `update` never drops or narrows a column, silently diverges between environments, and has no rollback. **Do not ship this to production as-is.** The migration path: set `DDL_AUTO=validate`, add `flyway-core` per service, and generate a baseline with `mvn hibernate:schema-export` or from `pg_dump -s`. Each service owns its own `db/migration` directory, since each owns its schema.

### Recharts is 537 kB

Larger than the rest of the app combined.

**Mitigated** by splitting it into its own chunk and lazy-loading the admin dashboard route, so a guest browsing rooms downloads ~150 kB and never fetches the chart bundle.

---

## 🔐 Security

- **Passwords** — BCrypt (Spring default strength 10). The hash never leaves auth-service; no DTO exposes it.
- **JWT** — HS256/HS512 over a shared secret. Claims carry `uid`, `name` and `role`, so downstream services resolve identity with **no database hit and no callback** to auth-service.
- **Secret length enforced at startup** — a secret under 32 bytes fails the service fast rather than signing tokens with a guessable key.
- **Header-spoofing blocked** — the gateway strips inbound `X-User-*` on *every* request, authenticated or not. Without this, a client could simply send `X-User-Role: ADMIN`. ([verify it](#verifying-it-end-to-end))
- **Privilege escalation blocked** — `/api/auth/register` always creates a `CUSTOMER`; a `role` in the body is ignored. Promotion is admin-only.
- **No account enumeration** — a wrong password and an unknown email return the identical `401`.
- **No id enumeration** — asking for someone else's booking returns `404`, not `403`.
- **Lockout protection** — the last remaining admin cannot be demoted, deactivated or deleted.
- **No secrets in the repo** — every credential is an environment variable with a dev-only default. `.env` is gitignored; `.env.example` documents each value.
- **CORS in exactly one place** — the gateway. Services disable it, because two sources would emit duplicate `Access-Control-Allow-Origin` headers and browsers reject that outright.
- **Containers run as a non-root user** on a JRE-only base image.
- **CSRF disabled deliberately** — no cookies are used, so there is no CSRF vector; the token travels in the `Authorization` header.

### Known limitations

Honest gaps, since this is a portfolio project rather than a production system:

- **No refresh tokens.** A 24h access token in `localStorage`. Real systems use a short access token plus an httpOnly refresh cookie. `localStorage` is readable by any XSS on the origin.
- **No token revocation.** Logout is client-side only; a stolen token stays valid until it expires. Revocation needs a denylist or short-lived tokens.
- **No rate limiting.** `/api/auth/login` is brute-forceable. Spring Cloud Gateway's `RequestRateLimiter` (Redis-backed) is the natural fix.
- **No HTTPS locally.** Terminated by Render/Vercel in the deployed setup.
- **Inter-service calls are unauthenticated.** booking-service → room-service carries no credential. Fine while room reads are public; mTLS or a service mesh would be the real answer.

---

## ☁️ Free deployment guide

**Vercel** (frontend) + **Render** (four Java services) + **Neon** (Postgres). All genuinely free.

### ⚠️ Read this first: chained cold starts

Render's free tier sleeps a service after ~15 minutes idle; waking takes 30–60s. **With microservices those cold starts chain.** One room search can wake the gateway, then booking-service, then room-service — in sequence. The first request after an idle period can take **60–90 seconds**, not the ~30s a single backend would cost.

Already built in to soften it:

- the gateway allows 45s per downstream call (`GATEWAY_TIMEOUT`, raised to 60s on Render)
- a cold service yields a clear, retryable `503` with `Retry-After` rather than an opaque error
- the React client **auto-retries idempotent GETs** on 502/503/504 with backoff, turning a cold start into a slow success
- booking-service's circuit breaker ignores 404s, so missing-id traffic can't trip it

Recommended on top:

- **Keep-alive ping.** A free [cron-job.org](https://cron-job.org) job every 10 minutes against each service's `/actuator/health`. Cheapest and most effective fix.
- **Or upgrade the gateway alone** to a paid instance — it removes the outermost hop.
- **Or [Option D](#option-d--one-always-on-vm-no-cold-starts-at-all)** if cold starts are unacceptable.

---

### Step 1 — Database (Neon)

1. Sign up at [neon.tech](https://neon.tech) → **New Project**, name it `hotel-booking`.
2. From the dashboard copy the **connection string**. Convert it to JDBC form:

   ```
   # Neon gives you:
   postgresql://user:pass@ep-cool-name-123.us-east-2.aws.neon.tech/neondb?sslmode=require

   # Spring needs:
   jdbc:postgresql://ep-cool-name-123.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

   Keep `user` and `pass` separate — they go in `DB_USERNAME` / `DB_PASSWORD`, not the URL.

3. In Neon's **SQL Editor**, create the three schemas:

   ```sql
   CREATE SCHEMA IF NOT EXISTS auth_service;
   CREATE SCHEMA IF NOT EXISTS room_service;
   CREATE SCHEMA IF NOT EXISTS booking_service;
   CREATE EXTENSION IF NOT EXISTS btree_gist;
   ```

   `btree_gist` backs the overlap constraint. If your plan refuses it, booking-service logs a warning and the portable `room_locks` guard still applies.

> Supabase works identically — use the **connection pooler** URI and the same JDBC conversion.

### Step 2 — Generate the JWT secret

```bash
openssl rand -base64 48
```

**All four Java services must receive the identical string.** auth-service signs with it; the gateway and the other two verify against it. A mismatch means every authenticated request 401s with no obvious cause.

### Step 3 — Backend (Render)

The repo includes **`render.yaml`**, so:

1. [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint** → connect this repo.
2. Render reads `render.yaml` and proposes five services. Apply.
3. Create the env group **`hotel-shared`** (Env Groups → New) with:

   | Key | Value |
   |---|---|
   | `JWT_SECRET` | the string from Step 2 |

   Attach it to all four Java services. It lives in a group *precisely because* it must be shared.

4. Fill the per-service `sync: false` values:

   | Key | On | Value |
   |---|---|---|
   | `DB_URL` | auth, rooms, bookings | your JDBC URL |
   | `DB_USERNAME` / `DB_PASSWORD` | auth, rooms, bookings | Neon credentials |
   | `ADMIN_EMAIL` / `ADMIN_PASSWORD` | auth | your admin login — **change from the default** |
   | `CORS_ALLOWED_ORIGINS` | gateway | `https://your-app.vercel.app,https://*.vercel.app` |

   `DB_SCHEMA` is already pinned per service in `render.yaml`.

5. Deploy **`hotel-discovery` first**, then auth / rooms / bookings, then **`hotel-gateway` last**.
6. Verify:

   ```bash
   curl https://hotel-gateway.onrender.com/actuator/health
   curl https://hotel-gateway.onrender.com/api/rooms
   ```

   The first call may take ~60s while everything wakes. That is expected, not a fault.

**Doing it manually instead?** Per service: New → **Web Service** → Runtime **Docker** → **Root Directory** = the service folder (e.g. `auth-service`) → set the env vars above. The root-directory setting is why each service has its own self-contained `pom.xml` and `Dockerfile`.

### Step 4 — Frontend (Vercel)

1. [vercel.com/new](https://vercel.com/new) → import this repo.
2. **Root Directory** → `frontend`. Vercel detects Vite and reads `frontend/vercel.json`.
3. Add one environment variable:

   | Key | Value |
   |---|---|
   | `VITE_API_BASE_URL` | `https://hotel-gateway.onrender.com` |

   > Vite inlines env vars at **build** time. Changing this needs a **redeploy**, not just a restart.

4. Deploy, then go back and make sure the gateway's `CORS_ALLOWED_ORIGINS` includes your real Vercel domain.

### Step 5 — Keep it awake

At [cron-job.org](https://cron-job.org), one job per service, every 10 minutes:

```
https://hotel-gateway.onrender.com/actuator/health
https://hotel-auth.onrender.com/actuator/health
https://hotel-rooms.onrender.com/actuator/health
https://hotel-bookings.onrender.com/actuator/health
```

### Option D — one always-on VM (no cold starts at all)

Oracle Cloud's Always Free ARM tier (4 cores / 24 GB) runs the entire compose stack with no sleeping:

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
git clone https://github.com/ajaychakravarthyg/Booking-App.git && cd Booking-App
cp .env.example .env      # set a real JWT_SECRET and POSTGRES_PASSWORD
sudo docker compose up -d --build
```

Put Caddy in front for automatic TLS, and keep the frontend on Vercel pointing at the VM. More manual setup, zero cold starts.

### Deployment checklist

- [ ] `JWT_SECRET` regenerated, ≥32 chars, **identical** across all four Java services
- [ ] `ADMIN_PASSWORD` changed from `Admin@12345`
- [ ] `DB_URL` in `jdbc:postgresql://…` form, with `?sslmode=require`
- [ ] All three schemas created in Neon
- [ ] `CORS_ALLOWED_ORIGINS` lists the real Vercel domain
- [ ] `VITE_API_BASE_URL` points at the gateway, and the frontend was **rebuilt** after setting it
- [ ] `DB_POOL_MAX` small (3–5) — three services share one free instance
- [ ] Keep-alive pings configured
- [ ] Consider `SEED_ENABLED=false` once you have real data

---

## 📁 Project layout

```
Booking-App/
├── discovery-server/          Eureka registry              :9761
├── api-gateway/               Spring Cloud Gateway         :9080
│   └── src/main/java/com/hotelbooking/gateway/
│       ├── filter/AuthenticationGatewayFilter.java   JWT verify + header stripping
│       ├── controller/FallbackController.java        clear 503 on cold start
│       └── security/JwtService.java
├── auth-service/              Identity                     :9081
│   └── src/main/java/com/hotelbooking/auth/
│       ├── controller/  service/  repository/  domain/  dto/
│       ├── security/    JwtService (issuer) · JwtAuthenticationFilter
│       ├── config/      SecurityConfig · AdminSeeder · OpenApiConfig
│       └── exception/   GlobalExceptionHandler · ApiErrorResponse
├── room-service/              Room catalog                 :9082
│   └── src/main/java/com/hotelbooking/room/
│       ├── repository/RoomSpecifications.java       composable dynamic filters
│       └── config/RoomSeeder.java                   10 sample rooms
├── booking-service/           Reservations                 :9083
│   └── src/main/java/com/hotelbooking/booking/
│       ├── domain/RoomLock.java                     ← the phantom-insert fix
│       ├── service/ReservationWriter.java           the short critical section
│       ├── service/RoomLockRegistrar.java           + RoomLockInserter
│       ├── client/RoomClient.java                   Feign → room-service
│       ├── client/RoomClientFallbackFactory.java    404 vs outage, told apart
│       ├── repository/BookingRepository.java        the overlap query
│       └── config/BookingConstraintInstaller.java   Postgres exclusion constraint
├── frontend/                  React SPA                    :5174 dev / :3000 docker
│   ├── src/
│   │   ├── lib/api.js                  axios + JWT + cold-start retry
│   │   ├── context/AuthContext.jsx
│   │   ├── components/ui/              Button · Card · Field · Feedback · Modal
│   │   ├── components/admin/           panels + Recharts dashboard
│   │   ├── pages/                      Rooms · RoomDetails · MyBookings · Admin · auth
│   │   └── index.css                   21st.dev theme tokens
│   ├── nginx.conf                      SPA fallback + API proxy
│   └── vercel.json
├── db/init/01-schemas.sql     one schema per service
├── docker-compose.yml         whole stack, health-gated startup
├── render.yaml                Render blueprint
├── .env.example               every variable, documented
└── docs/screenshots/
```

Each service is a **self-contained Maven project** with its own `pom.xml` and `Dockerfile` — no parent aggregator. That is what lets Render build one directory per service and deploy each independently.

---

## 🔭 What I would do next

In rough order of value:

1. **Flyway migrations** and `ddl-auto: validate` — the biggest gap between this and something shippable.
2. **Refresh tokens + revocation**, and move the access token out of `localStorage`.
3. **Rate limiting** on `/api/auth/login` via the gateway's Redis-backed `RequestRateLimiter`.
4. **An event broker** (Kafka or RabbitMQ) for `RoomDeleted` / `BookingConfirmed`, replacing the last synchronous coupling and closing the orphaned-booking gap.
5. **Test suites** — the concurrency behaviour above was verified by load-testing a running stack, which belongs in an automated Testcontainers suite so it cannot regress silently.
6. **Distributed tracing** — Micrometer Tracing + Zipkin. With five services, correlating one request across logs is already awkward.
7. **Payments** (Stripe test mode) and confirmation emails.

---

## 📄 License

MIT — see [LICENSE](LICENSE).

Built by **[Ajay Chakravarthy](https://github.com/ajaychakravarthyg)**. UI theme and component foundations from [21st.dev](https://21st.dev); room photography from [Unsplash](https://unsplash.com).
