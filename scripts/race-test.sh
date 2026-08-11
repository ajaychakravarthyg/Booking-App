#!/usr/bin/env bash
#
# Concurrency test for the double-booking guard.
#
#   ./scripts/race-test.sh [gateway-url] [requests-per-room]
#
# Fires N simultaneous IDENTICAL booking requests at rooms whose dates are currently free,
# which is the case a naive `SELECT ... FOR UPDATE` check gets wrong: with no existing rows
# to lock, every transaction reads an empty conflict set and every one inserts.
#
# Exactly one request must return 201. Anything else is a real double booking.
# See README > The interesting part, and booking-service's RoomLock.
#
# The script is repeat-safe: it picks a random date window each run and cancels the
# bookings it created on the way out, so it neither collides with its own previous runs
# nor leaves clutter in the demo data.

set -uo pipefail

GATEWAY="${1:-http://localhost:9080}"
N="${2:-15}"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

green() { printf '\033[32m%s\033[0m' "$1"; }
red() { printf '\033[31m%s\033[0m' "$1"; }
dim() { printf '\033[2m%s\033[0m' "$1"; }

echo
echo "Concurrency test → $GATEWAY  ($N simultaneous requests per room)"
echo

TOKEN=$(curl -s -X POST "$GATEWAY/api/auth/register" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Race Tester\",\"email\":\"race-$RANDOM-$$@example.com\",\"password\":\"Str0ngPassw0rd\"}" \
  | grep -oP '"token":"\K[^"]+')

if [[ -z "${TOKEN:-}" ]]; then
  echo "  $(red 'Could not register a test user — is the stack up?')"
  exit 1
fi

ADMIN_TOKEN=$(curl -s -X POST "$GATEWAY/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"${ADMIN_EMAIL:-admin@hotel.com}\",\"password\":\"${ADMIN_PASSWORD:-Admin@12345}\"}" \
  | grep -oP '"token":"\K[^"]+')

mapfile -t ROOM_IDS < <(curl -s "$GATEWAY/api/rooms?available=true" \
  | grep -oP '"id":\s*\K[0-9]+' | head -4)

if [[ ${#ROOM_IDS[@]} -eq 0 ]]; then
  echo "  $(red 'No rooms in the catalog — nothing to test.')"
  exit 1
fi

# A random base within the API's 365-day booking horizon, leaving room for the per-room
# stride and a 3-night stay. Randomising is what stops a second run from landing on the
# window the first run already filled — which would show up as 0×201 and look like a
# failure when the service was in fact behaving correctly.
BASE=$(( (RANDOM % 250) + 30 ))
FAILURES=0
ROUND=0
CREATED_IDS=()

for ROOM in "${ROOM_IDS[@]}"; do
  ROUND=$((ROUND + 1))
  OFFSET=$((BASE + ROUND * 9))
  CHECKIN=$(date -d "+$OFFSET days" +%Y-%m-%d 2>/dev/null || date -v+"$OFFSET"d +%Y-%m-%d)
  CHECKOUT=$(date -d "+$((OFFSET + 3)) days" +%Y-%m-%d 2>/dev/null || date -v+"$((OFFSET + 3))"d +%Y-%m-%d)

  # Confirm the window really is free before testing, so a genuine pre-existing booking is
  # reported as a skip rather than miscounted as a failure.
  FREE=$(curl -s "$GATEWAY/api/bookings/availability?roomId=$ROOM&checkIn=$CHECKIN&checkOut=$CHECKOUT" \
    | grep -oP '"available":\s*\K(true|false)')
  if [[ "$FREE" != "true" ]]; then
    printf '  %s room %-4s %s → skipped, window already booked\n' \
      "$(dim '•')" "$ROOM" "$CHECKIN"
    continue
  fi

  for i in $(seq 1 "$N"); do
    curl -s -X POST "$GATEWAY/api/bookings" \
      -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
      -d "{\"roomId\":$ROOM,\"checkInDate\":\"$CHECKIN\",\"checkOutDate\":\"$CHECKOUT\"}" \
      -o "$TMP/body-$ROOM-$i.json" -w '%{http_code}\n' >>"$TMP/codes-$ROOM.txt" 2>/dev/null &
  done
  wait 2>/dev/null

  CREATED=$(grep -c '^201$' "$TMP/codes-$ROOM.txt" || true)
  CONFLICT=$(grep -c '^409$' "$TMP/codes-$ROOM.txt" || true)
  ERRORS=$(grep -cE '^5[0-9][0-9]$' "$TMP/codes-$ROOM.txt" || true)

  # Collect the winner's id so it can be cancelled during cleanup.
  for f in "$TMP"/body-"$ROOM"-*.json; do
    ID=$(grep -oP '"id":\s*\K[0-9]+' "$f" 2>/dev/null | head -1)
    if [[ -n "$ID" ]] && grep -q '"status":"CONFIRMED"' "$f" 2>/dev/null; then
      CREATED_IDS+=("$ID")
    fi
  done

  if [[ "$CREATED" == "1" && "$ERRORS" == "0" ]]; then
    printf '  %s room %-4s %s → 201×%-3s 409×%-3s 5xx×%s\n' \
      "$(green '✓')" "$ROOM" "$CHECKIN" "$CREATED" "$CONFLICT" "$ERRORS"
  else
    printf '  %s room %-4s %s → 201×%-3s 409×%-3s 5xx×%s  %s\n' \
      "$(red '✗')" "$ROOM" "$CHECKIN" "$CREATED" "$CONFLICT" "$ERRORS" \
      "$(red 'expected exactly one 201 and no 5xx')"
    FAILURES=$((FAILURES + 1))
  fi
done

# Independent verification: ask the database (via the admin API) whether ANY room holds two
# confirmed bookings whose ranges overlap. Status codes alone could lie.
echo
echo "Verifying stored data for overlapping confirmed bookings…"

OVERLAPS=$(curl -s "$GATEWAY/api/bookings" -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -c '
import sys, json, collections
try:
    data = json.load(sys.stdin)
except Exception:
    print("ERROR: could not read the booking list"); sys.exit()

by_room = collections.defaultdict(list)
for b in data:
    if b["status"] == "CONFIRMED":
        by_room[b["roomId"]].append((b["checkInDate"], b["checkOutDate"], b["id"]))

bad = []
for room, stays in by_room.items():
    stays.sort()
    for i in range(len(stays) - 1):
        # Half-open intervals: [in, out). Overlap iff this one ends after the next starts.
        if stays[i][1] > stays[i + 1][0]:
            bad.append((room, stays[i], stays[i + 1]))

if bad:
    for room, a, b in bad:
        print(f"OVERLAP room {room}: #{a[2]} {a[0]}->{a[1]} vs #{b[2]} {b[0]}->{b[1]}")
else:
    print("CLEAN")
')

# Leave the data as we found it, so repeated runs stay meaningful.
if [[ ${#CREATED_IDS[@]} -gt 0 ]]; then
  for ID in "${CREATED_IDS[@]}"; do
    curl -s -o /dev/null -X PATCH "$GATEWAY/api/bookings/$ID/cancel" \
      -H "Authorization: Bearer $TOKEN" 2>/dev/null
  done
  echo "  $(dim "cleaned up ${#CREATED_IDS[@]} test booking(s)")"
fi

echo
if [[ "$OVERLAPS" == "CLEAN" && $FAILURES -eq 0 ]]; then
  echo "─────────────────────────────────────────────"
  printf '  %s  no double bookings, no 5xx, no overlapping rows\n' "$(green 'PASS')"
  echo "─────────────────────────────────────────────"
  exit 0
else
  echo "─────────────────────────────────────────────"
  printf '  %s  %s\n' "$(red 'FAIL')" "$OVERLAPS"
  echo "─────────────────────────────────────────────"
  exit 1
fi
