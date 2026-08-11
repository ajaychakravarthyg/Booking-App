import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarX, Hotel, Moon } from 'lucide-react'
import { bookingsApi, normalizeError } from '@/lib/api'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Alert, Badge, EmptyState, PageLoader } from '@/components/ui/Feedback'
import { formatDate, formatDateTime, formatMoney, pluralize } from '@/lib/format'

export default function MyBookings() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toCancel, setToCancel] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState(null)
  const [notice, setNotice] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await bookingsApi.mine()
      setBookings(data)
    } catch (err) {
      setError(err.status ? err : normalizeError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const confirmCancel = async () => {
    setCancelling(true)
    setCancelError(null)
    try {
      const { data } = await bookingsApi.cancel(toCancel.id)
      // Patch the one row in place rather than refetching the list — the response
      // already contains the updated booking.
      setBookings((current) => current.map((item) => (item.id === data.id ? data : item)))
      setNotice(`Booking #${data.id} for room ${data.roomNumber} was cancelled.`)
      setToCancel(null)
    } catch (err) {
      setCancelError(err.status ? err : normalizeError(err))
    } finally {
      setCancelling(false)
    }
  }

  if (loading) return <PageLoader label="Loading your bookings" />

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My bookings</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Cancelled reservations stay listed for your records, and their nights become
          bookable again immediately.
        </p>
      </header>

      {notice && (
        <Alert variant="success" className="mb-5">
          {notice}
        </Alert>
      )}

      {error && (
        <Alert variant="error" title="Could not load your bookings" onRetry={load} className="mb-5">
          {error.message}
        </Alert>
      )}

      {bookings.length === 0 && !error ? (
        <EmptyState
          icon={Hotel}
          title="No bookings yet"
          description="Once you reserve a room it will appear here, with the option to cancel."
          action={
            <Link to="/" className={buttonClasses({})}>
              Browse rooms
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {bookings.map((booking) => {
            const cancelled = booking.status === 'CANCELLED'
            return (
              <li key={booking.id}>
                <Card className={cancelled ? 'opacity-75' : undefined}>
                  <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={cancelled ? 'destructive' : 'success'}>
                          {cancelled ? 'Cancelled' : 'Confirmed'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Reference #{booking.id}
                        </span>
                      </div>

                      <h2 className="mt-2 text-lg font-semibold leading-snug">
                        {booking.roomType} Room {booking.roomNumber}
                      </h2>

                      <p className="mt-1.5 text-sm text-muted-foreground">
                        {formatDate(booking.checkInDate)} → {formatDate(booking.checkOutDate)}
                        <span className="mx-1.5">·</span>
                        <span className="inline-flex items-center gap-1">
                          <Moon className="h-3.5 w-3.5" aria-hidden="true" />
                          {pluralize(booking.nights, 'night')}
                        </span>
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        Booked {formatDateTime(booking.createdAt)}
                        {cancelled && booking.cancelledAt && (
                          <> · cancelled {formatDateTime(booking.cancelledAt)}</>
                        )}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center justify-between gap-4 sm:flex-col sm:items-end sm:gap-2">
                      <div className="text-right">
                        <p className="text-xl font-bold leading-none">
                          {formatMoney(booking.totalPrice)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatMoney(booking.pricePerNight)} / night
                        </p>
                      </div>

                      {/* `cancellable` is computed by the API — confirmed and not yet
                          started — so the UI never offers an action the server refuses. */}
                      {booking.cancellable ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setCancelError(null)
                            setToCancel(booking)
                          }}
                        >
                          <CalendarX className="h-4 w-4" aria-hidden="true" />
                          Cancel
                        </Button>
                      ) : (
                        !cancelled && (
                          <span className="text-xs text-muted-foreground">Stay has started</span>
                        )
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      <Modal
        open={Boolean(toCancel)}
        onClose={() => !cancelling && setToCancel(null)}
        title="Cancel this booking?"
        description={
          toCancel
            ? `Room ${toCancel.roomNumber}, ${formatDate(toCancel.checkInDate)} to ${formatDate(toCancel.checkOutDate)}.`
            : undefined
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setToCancel(null)} disabled={cancelling}>
              Keep booking
            </Button>
            <Button variant="destructive" onClick={confirmCancel} loading={cancelling}>
              Yes, cancel it
            </Button>
          </>
        }
      >
        {cancelError && (
          <Alert variant="error" title="Could not cancel" className="mb-4">
            {cancelError.message}
          </Alert>
        )}
        <p className="text-sm text-muted-foreground">
          This releases {toCancel ? pluralize(toCancel.nights, 'night') : 'the nights'} back to
          the calendar straight away. The record stays in your history, and this cannot be undone.
        </p>
      </Modal>
    </div>
  )
}
