import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, BedDouble, Check, ImageOff, MapPin, Star } from 'lucide-react'
import { bookingsApi, hotelsApi, normalizeError } from '@/lib/api'
import { RoomCard } from '@/components/RoomCard'
import { Card } from '@/components/ui/Card'
import { Field, Input } from '@/components/ui/Field'
import { Alert, Badge, EmptyState, PageLoader, RoomCardSkeleton } from '@/components/ui/Feedback'
import { buttonClasses } from '@/components/ui/Button'
import { formatDate, nightsBetween, pluralize, todayIso } from '@/lib/format'

export default function HotelDetails() {
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()

  const [hotel, setHotel] = useState(null)
  const [rooms, setRooms] = useState([])
  const [loadingHotel, setLoadingHotel] = useState(true)
  const [loadingRooms, setLoadingRooms] = useState(true)
  const [hotelError, setHotelError] = useState(null)
  const [roomsError, setRoomsError] = useState(null)
  const [imageFailed, setImageFailed] = useState(false)

  const checkIn = searchParams.get('checkIn') ?? ''
  const checkOut = searchParams.get('checkOut') ?? ''
  const guests = searchParams.get('guests') ?? ''
  const hasDates = Boolean(checkIn && checkOut)
  const nights = nightsBetween(checkIn, checkOut)

  const loadHotel = useCallback(async () => {
    setLoadingHotel(true)
    setHotelError(null)
    try {
      const { data } = await hotelsApi.get(id)
      setHotel(data)
    } catch (err) {
      setHotelError(err.status ? err : normalizeError(err))
    } finally {
      setLoadingHotel(false)
    }
  }, [id])

  const loadRooms = useCallback(async () => {
    setLoadingRooms(true)
    setRoomsError(null)
    try {
      /*
       * Two different endpoints, chosen by whether dates are set.
       *
       * With dates, booking-service filters out rooms with an overlapping reservation and
       * returns stay totals. Without them, room-service's catalogue is the right answer —
       * asking the availability endpoint for "no dates" would work but implies a date
       * filter that is not being applied.
       */
      const { data } = hasDates
        ? await bookingsApi.search({
            hotelId: id,
            checkIn,
            checkOut,
            ...(guests ? { guests } : {}),
          })
        : await hotelsApi.rooms(id)
      setRooms(data)
    } catch (err) {
      setRoomsError(err.status ? err : normalizeError(err))
      setRooms([])
    } finally {
      setLoadingRooms(false)
    }
  }, [id, checkIn, checkOut, guests, hasDates])

  useEffect(() => {
    loadHotel()
  }, [loadHotel])

  useEffect(() => {
    loadRooms()
  }, [loadRooms])

  const updateDates = (key) => (event) => {
    const next = new URLSearchParams(searchParams)
    const { value } = event.target
    if (value) next.set(key, value)
    else next.delete(key)

    // Keep the range coherent rather than letting an impossible one sit in the URL.
    if (key === 'checkIn' && next.get('checkOut') && next.get('checkOut') <= value) {
      const dayAfter = new Date(`${value}T00:00:00`)
      dayAfter.setDate(dayAfter.getDate() + 1)
      next.set('checkOut', dayAfter.toISOString().slice(0, 10))
    }
    setSearchParams(next, { replace: true })
  }

  if (loadingHotel) return <PageLoader label="Loading hotel" />

  if (hotelError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Alert variant="error" title="Could not load this hotel" onRetry={loadHotel}>
          {hotelError.message}
        </Alert>
        <Link to="/" className={buttonClasses({ variant: 'outline', className: 'mt-5' })}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to search
        </Link>
      </div>
    )
  }

  const backToCity = {
    pathname: '/search',
    search: new URLSearchParams(
      Object.fromEntries(
        Object.entries({ city: hotel.city, checkIn, checkOut, guests }).filter(([, v]) => v),
      ),
    ).toString(),
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb: the trail matters now that a room sits three levels deep. */}
      <nav aria-label="Breadcrumb" className="mb-5">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <li>
            <Link to="/" className="transition-colors hover:text-foreground">
              Destinations
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link to={backToCity} className="transition-colors hover:text-foreground">
              {hotel.city}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="font-medium text-foreground">{hotel.name}</li>
        </ol>
      </nav>

      {/* ── Property header ────────────────────────────────────────────────────── */}
      <div className="relative isolate h-56 overflow-hidden rounded-xl border border-border bg-muted sm:h-72">
        {hotel.imageUrl && !imageFailed ? (
          <img
            src={hotel.imageUrl}
            alt={hotel.name}
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <ImageOff className="h-10 w-10 text-muted-foreground/60" aria-hidden="true" />
          </div>
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/10"
        />
        <div className="relative flex h-full flex-col justify-end p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            {hotel.starRating && (
              <span
                className="inline-flex items-center gap-0.5"
                aria-label={`${hotel.starRating} star hotel`}
              >
                {Array.from({ length: hotel.starRating }).map((_, index) => (
                  <Star key={index} className="h-4 w-4 fill-warning text-warning" aria-hidden="true" />
                ))}
              </span>
            )}
            {!hotel.active && <Badge variant="destructive">Not currently listed</Badge>}
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {hotel.name}
          </h1>
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-white/85">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            {hotel.address ? `${hotel.address}, ` : ''}
            {hotel.city}, {hotel.country}
          </p>
        </div>
      </div>

      <div className="mt-7 grid grid-cols-1 gap-7 lg:grid-cols-[1fr_20rem]">
        <div>
          {hotel.description && (
            <p className="leading-relaxed text-foreground/85">{hotel.description}</p>
          )}

          {hotel.amenities?.length > 0 && (
            <section className="mt-6">
              <h2 className="text-base font-semibold">Facilities</h2>
              <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {hotel.amenities.map((amenity) => (
                  <li key={amenity} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                    {amenity}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* ── Date picker for this property ─────────────────────────────────────── */}
        <Card className="p-5 lg:sticky lg:top-24 lg:self-start">
          <h2 className="font-semibold">Check availability</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Set dates to hide rooms already taken and see stay totals.
          </p>
          <div className="mt-4 flex flex-col gap-3">
            <Field label="Check-in">
              {(props) => (
                <Input
                  {...props}
                  type="date"
                  value={checkIn}
                  min={todayIso()}
                  onChange={updateDates('checkIn')}
                />
              )}
            </Field>
            <Field
              label="Check-out"
              hint={nights > 0 ? pluralize(nights, 'night') : undefined}
            >
              {(props) => (
                <Input
                  {...props}
                  type="date"
                  value={checkOut}
                  min={checkIn || todayIso(1)}
                  onChange={updateDates('checkOut')}
                />
              )}
            </Field>
          </div>
        </Card>
      </div>

      {/* ── Rooms ──────────────────────────────────────────────────────────────── */}
      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-bold tracking-tight">
            {hasDates ? 'Rooms available for your dates' : 'All rooms'}
          </h2>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {loadingRooms
              ? 'Checking…'
              : `${rooms.length} ${rooms.length === 1 ? 'room' : 'rooms'}${
                  hasDates
                    ? ` free ${formatDate(checkIn)} → ${formatDate(checkOut)}`
                    : ' in this property'
                }`}
          </p>
        </div>

        {roomsError && (
          <Alert
            variant={roomsError.retryable ? 'warning' : 'error'}
            title="Could not load rooms"
            onRetry={loadRooms}
            className="mb-5"
          >
            {roomsError.message}
          </Alert>
        )}

        {loadingRooms ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <RoomCardSkeleton key={index} />
            ))}
          </div>
        ) : rooms.length === 0 && !roomsError ? (
          <EmptyState
            icon={BedDouble}
            title={hasDates ? 'No rooms free for those dates' : 'No rooms listed'}
            description={
              hasDates
                ? 'Every room here is taken for those nights. Try adjusting the dates, or look at other properties in this city.'
                : 'This property has no rooms in the catalogue yet.'
            }
            action={
              <Link to={backToCity} className={buttonClasses({ variant: 'outline' })}>
                Other hotels in {hotel.city}
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} checkIn={checkIn} checkOut={checkOut} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
