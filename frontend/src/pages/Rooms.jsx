import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BedDouble, SearchX } from 'lucide-react'
import { bookingsApi, normalizeError, roomsApi } from '@/lib/api'
import { RoomCard } from '@/components/RoomCard'
import { SearchBar } from '@/components/SearchBar'
import { Alert, EmptyState, RoomCardSkeleton } from '@/components/ui/Feedback'
import { PageHero } from '@/components/PageHero'
import { HERO } from '@/lib/images'
import { pluralize } from '@/lib/format'

/** Drops empty strings so they don't become `?type=` in the URL or the request. */
function compact(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== '' && value != null))
}

export default function Rooms() {
  // Filters live in the URL so a search is shareable and survives a refresh or a trip
  // to a room detail page and back.
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = {
    checkIn: searchParams.get('checkIn') ?? '',
    checkOut: searchParams.get('checkOut') ?? '',
    type: searchParams.get('type') ?? '',
    guests: searchParams.get('guests') ?? '',
    maxPrice: searchParams.get('maxPrice') ?? '',
    q: searchParams.get('q') ?? '',
  }

  const [rooms, setRooms] = useState([])
  const [roomTypes, setRoomTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetched once rather than hard-coded, so adding a room type to the backend enum
  // shows up here without a frontend change.
  useEffect(() => {
    roomsApi
      .types()
      .then(({ data }) => setRoomTypes(data))
      .catch(() => setRoomTypes([]))
  }, [])

  const load = useCallback(async (activeFilters) => {
    setLoading(true)
    setError(null)
    try {
      /*
       * Always the booking-service search endpoint, never room-service directly.
       *
       * room-service knows nothing about reservations, so its catalog would happily
       * list a room that is already taken for these dates. booking-service starts from
       * that catalog and subtracts its own overlapping bookings, and returns the stay
       * total alongside each room.
       */
      const { data } = await bookingsApi.search(compact(activeFilters))
      setRooms(data)
    } catch (err) {
      setError(err.status ? err : normalizeError(err))
      setRooms([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(filters)
    // Re-runs whenever the query string changes, which is the single source of truth.
  }, [load, searchParams])

  const handleSearch = (next) => setSearchParams(compact(next), { replace: true })

  const hasDates = Boolean(filters.checkIn && filters.checkOut)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHero
        image={HERO.rooms}
        eyebrow="Aurora Grand Hotel & Suites"
        title="Find your room"
        description="Pick your dates to see only what is genuinely available — rooms already reserved for those nights are filtered out before you ever see them."
        className="mb-6"
      />

      <SearchBar
        initial={filters}
        roomTypes={roomTypes}
        onSearch={handleSearch}
        loading={loading}
      />

      <div className="mt-7">
        {error && (
          <Alert
            variant="error"
            title="Could not load rooms"
            onRetry={() => load(filters)}
            className="mb-6"
          >
            {error.message}
          </Alert>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <RoomCardSkeleton key={index} />
            ))}
          </div>
        ) : rooms.length === 0 && !error ? (
          <EmptyState
            icon={SearchX}
            title="No rooms match your search"
            description={
              hasDates
                ? 'Every room is either taken for these dates or filtered out. Try shifting the dates or relaxing a filter.'
                : 'Try widening your filters — a different room type, more guests or a higher nightly rate.'
            }
          />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm text-muted-foreground" aria-live="polite">
                <span className="font-semibold text-foreground">{rooms.length}</span>{' '}
                {rooms.length === 1 ? 'room' : 'rooms'}
                {hasDates ? ' available for your dates' : ' in the catalog'}
              </p>
              {!hasDates && (
                <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <BedDouble className="h-3.5 w-3.5" aria-hidden="true" />
                  Add dates to check availability and see stay totals
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  checkIn={filters.checkIn}
                  checkOut={filters.checkOut}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
