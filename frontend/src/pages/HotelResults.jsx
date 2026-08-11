import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MapPin, SearchX } from 'lucide-react'
import { bookingsApi, citiesApi, normalizeError } from '@/lib/api'
import { CitySearchForm } from '@/components/CitySearchForm'
import { HotelCard } from '@/components/HotelCard'
import { Card } from '@/components/ui/Card'
import { Alert, EmptyState, Skeleton } from '@/components/ui/Feedback'
import { buttonClasses } from '@/components/ui/Button'
import { formatDate, pluralize } from '@/lib/format'

function compact(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== '' && value != null),
  )
}

function HotelCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card sm:flex-row">
      <Skeleton className="h-48 rounded-none sm:h-auto sm:w-64 lg:w-72" />
      <div className="flex-1 space-y-3 p-5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-3 w-full" />
        <div className="flex justify-between pt-4">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
    </div>
  )
}

export default function HotelResults() {
  // Filters live in the URL so a search is shareable and survives a reload or a trip into a
  // hotel and back.
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = {
    city: searchParams.get('city') ?? '',
    checkIn: searchParams.get('checkIn') ?? '',
    checkOut: searchParams.get('checkOut') ?? '',
    guests: searchParams.get('guests') ?? '',
  }

  const [hotels, setHotels] = useState([])
  const [cities, setCities] = useState([])
  const [loading, setLoading] = useState(Boolean(filters.city))
  const [error, setError] = useState(null)

  useEffect(() => {
    citiesApi
      .list()
      .then(({ data }) => setCities(data))
      .catch(() => setCities([]))
  }, [])

  const load = useCallback(async (active) => {
    // Without a city there is nothing to suggest — the API requires one.
    if (!active.city) {
      setHotels([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      /*
       * booking-service, not room-service.
       *
       * room-service could list the city's hotels, but its counts and "from" price ignore
       * dates entirely. This endpoint subtracts real reservations, so a property shown here
       * genuinely has something free — and the price quoted belongs to a room still available.
       */
      const { data } = await bookingsApi.suggestHotels(compact(active))
      setHotels(data)
    } catch (err) {
      setError(err.status ? err : normalizeError(err))
      setHotels([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(filters)
  }, [load, searchParams])

  const handleSearch = (next) => setSearchParams(compact(next), { replace: true })

  const hasDates = Boolean(filters.checkIn && filters.checkOut)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Card className="p-4 sm:p-5">
        <CitySearchForm initial={filters} onSearch={handleSearch} loading={loading} compact />
      </Card>

      {/* ── No city chosen yet ───────────────────────────────────────────────── */}
      {!filters.city ? (
        <div className="mt-8">
          <h1 className="text-xl font-bold tracking-tight">Pick a destination</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a city above, or start from one of these.
          </p>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cities.map((city) => (
              <Link
                key={`${city.city}-${city.country}`}
                to={{ pathname: '/search', search: `city=${encodeURIComponent(city.city)}` }}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
              >
                <span className="inline-flex items-center gap-2.5">
                  <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span>
                    <span className="block font-medium">{city.city}</span>
                    <span className="block text-xs text-muted-foreground">{city.country}</span>
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {pluralize(city.hotelCount, 'hotel')}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-7">
          <header className="mb-5">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Hotels in {filters.city}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground" aria-live="polite">
              {loading ? (
                'Checking availability…'
              ) : (
                <>
                  <span className="font-semibold text-foreground">{hotels.length}</span>{' '}
                  {hotels.length === 1 ? 'property' : 'properties'}
                  {hasDates ? (
                    <>
                      {' '}with rooms free {formatDate(filters.checkIn)} → {formatDate(filters.checkOut)}
                    </>
                  ) : (
                    ' listed'
                  )}
                  {filters.guests ? ` · sleeping ${pluralize(Number(filters.guests), 'guest')}` : ''}
                </>
              )}
            </p>
          </header>

          {error && (
            <Alert
              variant={error.retryable ? 'warning' : 'error'}
              title="Could not load hotels"
              onRetry={() => load(filters)}
              className="mb-6"
            >
              {error.message}
            </Alert>
          )}

          {loading ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <HotelCardSkeleton key={index} />
              ))}
            </div>
          ) : hotels.length === 0 && !error ? (
            <EmptyState
              icon={SearchX}
              title={hasDates ? 'Nothing free for those dates' : `No hotels in ${filters.city}`}
              description={
                hasDates
                  ? 'Every property in this city is fully booked for those nights, or filtered out by your guest count. Try shifting the dates by a day or two.'
                  : 'This destination has no listed properties right now.'
              }
              action={
                <Link to="/" className={buttonClasses({ variant: 'outline' })}>
                  Try another destination
                </Link>
              }
            />
          ) : (
            <div className="flex flex-col gap-4">
              {hotels.map((hotel) => (
                <HotelCard
                  key={hotel.hotelId}
                  hotel={hotel}
                  checkIn={filters.checkIn}
                  checkOut={filters.checkOut}
                  guests={filters.guests}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
