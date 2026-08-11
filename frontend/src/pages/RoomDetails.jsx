import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  BedDouble,
  CalendarCheck,
  Check,
  CircleSlash,
  ImageOff,
  MapPin,
  Users,
} from 'lucide-react'
import { bookingsApi, normalizeError, roomsApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Field, Input } from '@/components/ui/Field'
import { Alert, Badge, PageLoader, Spinner } from '@/components/ui/Feedback'
import { formatDate, formatMoney, nightsBetween, pluralize, todayIso } from '@/lib/format'

export default function RoomDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [searchParams] = useSearchParams()

  const [room, setRoom] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [imageFailed, setImageFailed] = useState(false)

  // Carried over from the search so the guest does not re-enter dates they just picked.
  const [dates, setDates] = useState({
    checkIn: searchParams.get('checkIn') ?? '',
    checkOut: searchParams.get('checkOut') ?? '',
  })

  const [availability, setAvailability] = useState(null)
  const [checking, setChecking] = useState(false)
  const [booking, setBooking] = useState(false)
  const [bookingError, setBookingError] = useState(null)
  const [confirmed, setConfirmed] = useState(null)

  const nights = nightsBetween(dates.checkIn, dates.checkOut)
  const datesValid = nights > 0

  const loadRoom = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const { data } = await roomsApi.get(id)
      setRoom(data)
    } catch (err) {
      setLoadError(err.status ? err : normalizeError(err))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadRoom()
  }, [loadRoom])

  /*
   * Probe availability whenever a valid range is entered.
   *
   * Debounced because date inputs fire on every keystroke when typed rather than picked,
   * and each probe costs booking-service a call into room-service.
   */
  useEffect(() => {
    if (!datesValid) {
      setAvailability(null)
      return
    }
    let cancelled = false
    setChecking(true)

    const timer = window.setTimeout(() => {
      bookingsApi
        .checkAvailability({ roomId: id, checkIn: dates.checkIn, checkOut: dates.checkOut })
        .then(({ data }) => {
          if (!cancelled) setAvailability(data.available)
        })
        .catch(() => {
          // Leave it unknown rather than claiming unavailable — the booking attempt is
          // the authoritative check anyway.
          if (!cancelled) setAvailability(null)
        })
        .finally(() => {
          if (!cancelled) setChecking(false)
        })
    }, 400)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [id, dates.checkIn, dates.checkOut, datesValid])

  const updateDate = (key) => (event) => {
    const { value } = event.target
    setDates((current) => {
      const next = { ...current, [key]: value }
      if (key === 'checkIn' && next.checkOut && next.checkOut <= value) {
        const dayAfter = new Date(`${value}T00:00:00`)
        dayAfter.setDate(dayAfter.getDate() + 1)
        next.checkOut = dayAfter.toISOString().slice(0, 10)
      }
      return next
    })
    setBookingError(null)
  }

  const handleBook = async (event) => {
    event.preventDefault()

    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: `/rooms/${id}` } } })
      return
    }

    setBooking(true)
    setBookingError(null)
    try {
      const { data } = await bookingsApi.create({
        roomId: Number(id),
        checkInDate: dates.checkIn,
        checkOutDate: dates.checkOut,
      })
      setConfirmed(data)
    } catch (err) {
      const normalized = err.status ? err : normalizeError(err)
      setBookingError(normalized)
      // A 409 means someone took these nights between the probe and the submit, so the
      // stale "available" badge must go.
      if (normalized.status === 409) setAvailability(false)
    } finally {
      setBooking(false)
    }
  }

  if (loading) return <PageLoader label="Loading room" />

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Alert variant="error" title="Could not load this room" onRetry={loadRoom}>
          {loadError.message}
        </Alert>
        <Link to="/" className={buttonClasses({ variant: 'outline', className: 'mt-5' })}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to search
        </Link>
      </div>
    )
  }

  const estimatedTotal = datesValid ? Number(room.pricePerNight) * nights : null

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Destinations / City / Hotel / Room — the trail matters now that a room sits three
          levels deep in the catalogue. */}
      <nav aria-label="Breadcrumb" className="mb-5">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <li>
            <Link to="/" className="transition-colors hover:text-foreground">
              Destinations
            </Link>
          </li>
          {room.hotelCity && (
            <>
              <li aria-hidden="true">/</li>
              <li>
                <Link
                  to={{
                    pathname: '/search',
                    search: new URLSearchParams(
                      Object.fromEntries(
                        Object.entries({
                          city: room.hotelCity,
                          checkIn: dates.checkIn,
                          checkOut: dates.checkOut,
                        }).filter(([, v]) => v),
                      ),
                    ).toString(),
                  }}
                  className="transition-colors hover:text-foreground"
                >
                  {room.hotelCity}
                </Link>
              </li>
            </>
          )}
          {room.hotelName && (
            <>
              <li aria-hidden="true">/</li>
              <li>
                <Link
                  to={{
                    pathname: `/hotels/${room.hotelId}`,
                    search: searchParams.toString(),
                  }}
                  className="transition-colors hover:text-foreground"
                >
                  {room.hotelName}
                </Link>
              </li>
            </>
          )}
          <li aria-hidden="true">/</li>
          <li className="font-medium text-foreground">Room {room.roomNumber}</li>
        </ol>
      </nav>

      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[1.6fr_1fr]">
        {/* ── Room ─────────────────────────────────────────────────────────────── */}
        <div>
          <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-border bg-muted">
            {room.imageUrl && !imageFailed ? (
              <img
                src={room.imageUrl}
                alt={`${room.typeLabel} room ${room.roomNumber}`}
                className="h-full w-full object-cover"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <ImageOff className="h-10 w-10 text-muted-foreground/60" aria-hidden="true" />
              </div>
            )}
          </div>

          <div className="mt-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="primary">{room.typeLabel}</Badge>
              {room.available ? (
                <Badge variant="success">In service</Badge>
              ) : (
                <Badge variant="destructive">Out of service</Badge>
              )}
            </div>

            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              {room.typeLabel} Room {room.roomNumber}
            </h1>

            {room.hotelName && (
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                <Link
                  to={`/hotels/${room.hotelId}`}
                  className="font-medium text-foreground transition-colors hover:text-primary hover:underline"
                >
                  {room.hotelName}
                </Link>
                {room.hotelCity && <span>· {room.hotelCity}, {room.hotelCountry}</span>}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4" aria-hidden="true" />
                Sleeps {pluralize(room.capacity, 'guest')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BedDouble className="h-4 w-4" aria-hidden="true" />
                {room.typeLabel}
              </span>
            </div>

            {room.description && (
              <p className="mt-5 leading-relaxed text-foreground/85">{room.description}</p>
            )}

            {room.amenities?.length > 0 && (
              <section className="mt-7">
                <h2 className="text-base font-semibold">What this room offers</h2>
                <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {room.amenities.map((amenity) => (
                    <li key={amenity} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                      {amenity}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>

        {/* ── Booking panel ────────────────────────────────────────────────────── */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>
                {formatMoney(room.pricePerNight)}
                <span className="ml-1 text-sm font-normal text-muted-foreground">per night</span>
              </CardTitle>
            </CardHeader>

            <CardContent>
              {confirmed ? (
                // Success replaces the form entirely — leaving it live invites a
                // duplicate booking for the same nights.
                <div className="flex flex-col gap-4">
                  <Alert variant="success" title="Your booking is confirmed">
                    Reference #{confirmed.id} · {formatDate(confirmed.checkInDate)} →{' '}
                    {formatDate(confirmed.checkOutDate)}
                  </Alert>

                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Nights</dt>
                      <dd className="font-medium">{confirmed.nights}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Rate</dt>
                      <dd className="font-medium">{formatMoney(confirmed.pricePerNight)} / night</dd>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2 text-base">
                      <dt className="font-semibold">Total</dt>
                      <dd className="font-bold">{formatMoney(confirmed.totalPrice)}</dd>
                    </div>
                  </dl>

                  <Link to="/my-bookings" className={buttonClasses({})}>
                    <CalendarCheck className="h-4 w-4" aria-hidden="true" />
                    View my bookings
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleBook} className="flex flex-col gap-4" noValidate>
                  <Field label="Check-in" required>
                    {(props) => (
                      <Input
                        {...props}
                        type="date"
                        required
                        min={todayIso()}
                        value={dates.checkIn}
                        onChange={updateDate('checkIn')}
                      />
                    )}
                  </Field>

                  <Field label="Check-out" required>
                    {(props) => (
                      <Input
                        {...props}
                        type="date"
                        required
                        min={dates.checkIn || todayIso(1)}
                        value={dates.checkOut}
                        onChange={updateDate('checkOut')}
                      />
                    )}
                  </Field>

                  {datesValid && (
                    <div className="rounded-lg border border-border bg-muted/40 p-3.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {formatMoney(room.pricePerNight)} × {pluralize(nights, 'night')}
                        </span>
                        <span className="font-medium">{formatMoney(estimatedTotal)}</span>
                      </div>
                      <div className="mt-2 flex justify-between border-t border-border pt-2">
                        <span className="font-semibold">Total</span>
                        <span className="font-bold">{formatMoney(estimatedTotal)}</span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Confirmed by the server at booking time — {formatDate(dates.checkIn)} to{' '}
                        {formatDate(dates.checkOut)}.
                      </p>
                    </div>
                  )}

                  {/* Live availability, so the guest is not surprised on submit. */}
                  {datesValid && (
                    <div aria-live="polite">
                      {checking ? (
                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Spinner className="h-4 w-4" label="Checking availability" />
                          Checking these dates…
                        </p>
                      ) : availability === true ? (
                        <p className="flex items-center gap-2 text-sm font-medium text-success">
                          <Check className="h-4 w-4" aria-hidden="true" />
                          Available for these dates
                        </p>
                      ) : availability === false ? (
                        <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                          <CircleSlash className="h-4 w-4" aria-hidden="true" />
                          Already booked for these dates
                        </p>
                      ) : null}
                    </div>
                  )}

                  {bookingError && (
                    <Alert variant="error" title="Could not complete your booking">
                      {bookingError.message}
                      {bookingError.fieldErrors &&
                        Object.values(bookingError.fieldErrors).length > 0 && (
                          <ul className="mt-1.5 list-inside list-disc">
                            {Object.values(bookingError.fieldErrors).map((message) => (
                              <li key={message}>{message}</li>
                            ))}
                          </ul>
                        )}
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    size="lg"
                    loading={booking}
                    disabled={!datesValid || !room.available || availability === false}
                  >
                    {isAuthenticated ? 'Confirm booking' : 'Sign in to book'}
                  </Button>

                  {!room.available && (
                    <p className="text-center text-xs text-muted-foreground">
                      This room is currently out of service and cannot be booked.
                    </p>
                  )}
                  {!datesValid && (
                    <p className="text-center text-xs text-muted-foreground">
                      Choose your dates to see the total.
                    </p>
                  )}
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
