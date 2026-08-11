#!/usr/bin/env bash
#
# End-to-end smoke test against a running stack.
#
#   ./scripts/smoke-test.sh [gateway-url]
#
# Walks the whole guest and admin journey through the gateway and asserts the HTTP
# status of each step. Exits non-zero on the first mismatch, so it is usable in CI.

set -uo pipefail

GATEWAY="${1:-http://localhost:9080}"
PASS=0
FAIL=0

green() { printf '\033[32m%s\033[0m' "$1"; }
red() { printf '\033[31m%s\033[0m' "$1"; }
dim() { printf '\033[2m%s\033[0m' "$1"; }

# assert <expected-status> <label> <curl args...>
assert() {
  local expected="$1" label="$2"
  shift 2
  local body status
  body=$(curl -s -w '\n%{http_code}' "$@" 2>/dev/null)
  status="${body##*$'\n'}"
  body="${body%$'\n'*}"

  if [[ "$status" == "$expected" ]]; then
    printf '  %s %-56s %s\n' "$(green '✓')" "$label" "$(dim "$status")"
    PASS=$((PASS + 1))
  else
    printf '  %s %-56s %s\n' "$(red '✗')" "$label" "$(red "got $status, wanted $expected")"
    printf '      %s\n' "$(dim "${body:0:200}")"
    FAIL=$((FAIL + 1))
  fi
  LAST_BODY="$body"
}

json_field() { grep -oP "\"$1\":\s*\"?\K[^\",}]+" <<<"$2" | head -1; }

echo
echo "Smoke test → $GATEWAY"
echo

# Wait until the gateway can actually ROUTE to every service, not merely until its own
# /actuator/health answers. Health proves the gateway is up; routing additionally requires
# the service registry to have converged, and a just-restarted instance can linger in
# Eureka as a stale entry for a few seconds.
printf '  waiting for routes to converge'
for _ in $(seq 1 40); do
  R=$(curl -s -o /dev/null -w '%{http_code}' "$GATEWAY/api/rooms" 2>/dev/null)
  B=$(curl -s -o /dev/null -w '%{http_code}' "$GATEWAY/api/bookings/search" 2>/dev/null)
  A=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$GATEWAY/api/auth/login" \
        -H 'Content-Type: application/json' -d '{"email":"x@y.z","password":"nope"}' 2>/dev/null)
  # 401 from login is a healthy answer — it means auth-service was reached.
  if [[ "$R" == "200" && "$B" == "200" && "$A" == "401" ]]; then echo " ready"; break; fi
  printf '.'
  sleep 2
done
echo

# ── Availability ──────────────────────────────────────────────────────────────────
echo "Public browsing"
assert 200 "GET /api/rooms (catalog, no auth)" "$GATEWAY/api/rooms?available=true"
assert 200 "GET /api/rooms/types" "$GATEWAY/api/rooms/types"
assert 200 "GET /api/bookings/search (no dates)" "$GATEWAY/api/bookings/search"
assert 400 "GET /api/bookings/search (only one date → 400)" \
  "$GATEWAY/api/bookings/search?checkIn=2027-06-01"

# Dates far enough out that repeat runs do not collide with earlier ones.
CHECKIN=$(date -d '+200 days' +%Y-%m-%d 2>/dev/null || date -v+200d +%Y-%m-%d)
CHECKOUT=$(date -d '+203 days' +%Y-%m-%d 2>/dev/null || date -v+203d +%Y-%m-%d)
NEXT=$(date -d '+205 days' +%Y-%m-%d 2>/dev/null || date -v+205d +%Y-%m-%d)

assert 200 "GET /api/bookings/search ($CHECKIN → $CHECKOUT)" \
  "$GATEWAY/api/bookings/search?checkIn=$CHECKIN&checkOut=$CHECKOUT"
ROOM_ID=$(grep -oP '"id":\s*\K[0-9]+' <<<"$LAST_BODY" | head -1)
echo "      $(dim "using room id $ROOM_ID")"

# ── Auth ──────────────────────────────────────────────────────────────────────────
echo
echo "Authentication"
EMAIL="smoke-$RANDOM@example.com"
assert 201 "POST /api/auth/register" -X POST "$GATEWAY/api/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Smoke Test\",\"email\":\"$EMAIL\",\"password\":\"Str0ngPassw0rd\"}"
TOKEN=$(json_field token "$LAST_BODY")

assert 400 "POST /api/auth/register (bad payload → 400)" -X POST "$GATEWAY/api/auth/register" \
  -H 'Content-Type: application/json' -d '{"name":"x","email":"nope","password":"short"}'
assert 409 "POST /api/auth/register (duplicate email → 409)" -X POST "$GATEWAY/api/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Smoke Test\",\"email\":\"$EMAIL\",\"password\":\"Str0ngPassw0rd\"}"
assert 401 "POST /api/auth/login (wrong password → 401)" -X POST "$GATEWAY/api/auth/login" \
  -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"wrong-password\"}"
assert 200 "GET /api/auth/me" "$GATEWAY/api/auth/me" -H "Authorization: Bearer $TOKEN"

assert 200 "POST /api/auth/login (admin)" -X POST "$GATEWAY/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${ADMIN_EMAIL:-admin@hotel.com}\",\"password\":\"${ADMIN_PASSWORD:-Admin@12345}\"}"
ADMIN_TOKEN=$(json_field token "$LAST_BODY")

# ── Authorization ─────────────────────────────────────────────────────────────────
echo
echo "Authorization"
assert 401 "GET /api/users (no token → 401)" "$GATEWAY/api/users"
assert 403 "GET /api/users (customer token → 403)" "$GATEWAY/api/users" \
  -H "Authorization: Bearer $TOKEN"
assert 200 "GET /api/users (admin token)" "$GATEWAY/api/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
assert 401 "GET /api/users (spoofed X-User-Role → 401)" "$GATEWAY/api/users" \
  -H 'X-User-Role: ADMIN' -H 'X-User-Id: 1' -H 'X-User-Email: admin@hotel.com'
assert 401 "GET /api/bookings/my (garbage token → 401)" "$GATEWAY/api/bookings/my" \
  -H 'Authorization: Bearer not.a.real.token'
assert 403 "POST /api/rooms (customer → 403)" -X POST "$GATEWAY/api/rooms" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"roomNumber":"S1","type":"SUITE","pricePerNight":100,"capacity":2,"available":true}'

# ── Booking ───────────────────────────────────────────────────────────────────────
echo
echo "Booking rules"
assert 201 "POST /api/bookings" -X POST "$GATEWAY/api/bookings" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"roomId\":$ROOM_ID,\"checkInDate\":\"$CHECKIN\",\"checkOutDate\":\"$CHECKOUT\"}"
BOOKING_ID=$(grep -oP '"id":\s*\K[0-9]+' <<<"$LAST_BODY" | head -1)
TOTAL=$(grep -oP '"totalPrice":\s*\K[0-9.]+' <<<"$LAST_BODY" | head -1)
NIGHTS=$(grep -oP '"nights":\s*\K[0-9]+' <<<"$LAST_BODY" | head -1)
echo "      $(dim "booking #$BOOKING_ID · $NIGHTS nights · total $TOTAL")"

assert 409 "POST /api/bookings (overlapping range → 409)" -X POST "$GATEWAY/api/bookings" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"roomId\":$ROOM_ID,\"checkInDate\":\"$CHECKIN\",\"checkOutDate\":\"$CHECKOUT\"}"
assert 201 "POST /api/bookings (same-day changeover → 201)" -X POST "$GATEWAY/api/bookings" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"roomId\":$ROOM_ID,\"checkInDate\":\"$CHECKOUT\",\"checkOutDate\":\"$NEXT\"}"
CHANGEOVER_ID=$(grep -oP '"id":\s*\K[0-9]+' <<<"$LAST_BODY" | head -1)

assert 400 "POST /api/bookings (checkout before checkin → 400)" -X POST "$GATEWAY/api/bookings" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"roomId\":$ROOM_ID,\"checkInDate\":\"$CHECKOUT\",\"checkOutDate\":\"$CHECKIN\"}"
assert 400 "POST /api/bookings (past date → 400)" -X POST "$GATEWAY/api/bookings" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"roomId\":$ROOM_ID,\"checkInDate\":\"2020-01-01\",\"checkOutDate\":\"2020-01-05\"}"
assert 404 "POST /api/bookings (nonexistent room → 404)" -X POST "$GATEWAY/api/bookings" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"roomId\":999999,\"checkInDate\":\"$CHECKIN\",\"checkOutDate\":\"$CHECKOUT\"}"
assert 401 "POST /api/bookings (no token → 401)" -X POST "$GATEWAY/api/bookings" \
  -H 'Content-Type: application/json' \
  -d "{\"roomId\":$ROOM_ID,\"checkInDate\":\"$CHECKIN\",\"checkOutDate\":\"$CHECKOUT\"}"

# ── Ownership isolation ───────────────────────────────────────────────────────────
echo
echo "Ownership isolation"
assert 201 "POST /api/auth/register (second guest)" -X POST "$GATEWAY/api/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Other Guest\",\"email\":\"other-$RANDOM@example.com\",\"password\":\"Str0ngPassw0rd\"}"
OTHER_TOKEN=$(json_field token "$LAST_BODY")

assert 404 "GET another guest's booking → 404 (not 403)" "$GATEWAY/api/bookings/$BOOKING_ID" \
  -H "Authorization: Bearer $OTHER_TOKEN"
assert 404 "PATCH another guest's cancel → 404" -X PATCH \
  "$GATEWAY/api/bookings/$BOOKING_ID/cancel" -H "Authorization: Bearer $OTHER_TOKEN"

# ── Cancellation ──────────────────────────────────────────────────────────────────
echo
echo "Cancellation"
assert 200 "GET /api/bookings/my" "$GATEWAY/api/bookings/my" -H "Authorization: Bearer $TOKEN"
assert 200 "PATCH /api/bookings/$BOOKING_ID/cancel" -X PATCH \
  "$GATEWAY/api/bookings/$BOOKING_ID/cancel" -H "Authorization: Bearer $TOKEN"
assert 400 "PATCH cancel again → 400" -X PATCH \
  "$GATEWAY/api/bookings/$BOOKING_ID/cancel" -H "Authorization: Bearer $TOKEN"
assert 201 "POST /api/bookings (dates freed by cancel → 201)" -X POST "$GATEWAY/api/bookings" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"roomId\":$ROOM_ID,\"checkInDate\":\"$CHECKIN\",\"checkOutDate\":\"$CHECKOUT\"}"

# ── Admin ─────────────────────────────────────────────────────────────────────────
echo
echo "Admin"
assert 200 "GET /api/bookings (all)" "$GATEWAY/api/bookings" -H "Authorization: Bearer $ADMIN_TOKEN"
assert 200 "GET /api/bookings/stats" "$GATEWAY/api/bookings/stats" -H "Authorization: Bearer $ADMIN_TOKEN"
assert 200 "GET /api/rooms/stats" "$GATEWAY/api/rooms/stats" -H "Authorization: Bearer $ADMIN_TOKEN"
assert 200 "GET /api/users/stats" "$GATEWAY/api/users/stats" -H "Authorization: Bearer $ADMIN_TOKEN"

RNUM="T$RANDOM"
assert 201 "POST /api/rooms (admin create)" -X POST "$GATEWAY/api/rooms" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"roomNumber\":\"$RNUM\",\"type\":\"SUITE\",\"pricePerNight\":299.99,\"capacity\":4,\"description\":\"Smoke test suite\",\"amenities\":[\"Wi-Fi\"],\"available\":true}"
NEW_ROOM_ID=$(grep -oP '"id":\s*\K[0-9]+' <<<"$LAST_BODY" | head -1)

assert 409 "POST /api/rooms (duplicate number → 409)" -X POST "$GATEWAY/api/rooms" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"roomNumber\":\"$RNUM\",\"type\":\"SUITE\",\"pricePerNight\":299.99,\"capacity\":4,\"available\":true}"
assert 200 "PUT /api/rooms/$NEW_ROOM_ID" -X PUT "$GATEWAY/api/rooms/$NEW_ROOM_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"roomNumber\":\"$RNUM\",\"type\":\"DELUXE\",\"pricePerNight\":249.00,\"capacity\":3,\"available\":false}"
assert 204 "DELETE /api/rooms/$NEW_ROOM_ID" -X DELETE "$GATEWAY/api/rooms/$NEW_ROOM_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# ── Docs ──────────────────────────────────────────────────────────────────────────
echo
echo "Documentation"
assert 200 "GET /swagger-ui.html" -L "$GATEWAY/swagger-ui.html"
for svc in auth rooms bookings; do
  assert 200 "GET /api-docs/$svc" "$GATEWAY/api-docs/$svc"
done

# ── Result ────────────────────────────────────────────────────────────────────────
echo
echo "─────────────────────────────────────────────"
if [[ $FAIL -eq 0 ]]; then
  printf '  %s  %d passed, 0 failed\n' "$(green 'PASS')" "$PASS"
  echo "─────────────────────────────────────────────"
  exit 0
else
  printf '  %s  %d passed, %d FAILED\n' "$(red 'FAIL')" "$PASS" "$FAIL"
  echo "─────────────────────────────────────────────"
  exit 1
fi
