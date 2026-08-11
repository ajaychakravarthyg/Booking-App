import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarRange, CalendarX } from 'lucide-react'
import { bookingsApi, normalizeError } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Alert, Badge, EmptyState, PageLoader } from '@/components/ui/Feedback'
import { formatDate, formatDateTime, formatMoney } from '@/lib/format'

export function BookingsPanel({ onChanged }) {
  const [bookings, setBookings] = useState([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const [toCancel, setToCancel] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState(null)

  const load = useCallback(async (activeStatus) => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await bookingsApi.listAll(activeStatus ? { status: activeStatus } : {})
      setBookings(data)
    } catch (err) {
      setError(err.status ? err : normalizeError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(status)
  }, [load, status])

  const totals = useMemo(() => {
    const confirmed = bookings.filter((booking) => booking.status === 'CONFIRMED')
    return {
      count: bookings.length,
      revenue: confirmed.reduce((sum, booking) => sum + Number(booking.totalPrice), 0),
    }
  }, [bookings])

  const confirmCancel = async () => {
    setCancelling(true)
    setCancelError(null)
    try {
      const { data } = await bookingsApi.cancel(toCancel.id)
      setBookings((current) => current.map((item) => (item.id === data.id ? data : item)))
      setNotice(`Booking #${data.id} was cancelled on behalf of ${data.userName}.`)
      setToCancel(null)
      onChanged?.()
    } catch (err) {
      setCancelError(err.status ? err : normalizeError(err))
    } finally {
      setCancelling(false)
    }
  }

  if (loading) return <PageLoader label="Loading bookings" />

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">All bookings</h2>
          <p className="text-sm text-muted-foreground">
            {totals.count} {totals.count === 1 ? 'reservation' : 'reservations'} ·{' '}
            {formatMoney(totals.revenue)} confirmed value
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Status</span>
          <Select value={status} onChange={(event) => setStatus(event.target.value)} className="w-40">
            <option value="">All</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </label>
      </div>

      {notice && (
        <Alert variant="success" className="mb-4">
          {notice}
        </Alert>
      )}
      {error && (
        <Alert variant="error" title="Could not load bookings" onRetry={() => load(status)} className="mb-4">
          {error.message}
        </Alert>
      )}

      {bookings.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title={status ? `No ${status.toLowerCase()} bookings` : 'No bookings yet'}
          description="Reservations made by guests will appear here."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-sm">
              <thead className="border-b border-border bg-muted/40 text-left">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">#</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Guest</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Room</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Stay</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Nights</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Total</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bookings.map((booking) => (
                  <tr key={booking.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 text-muted-foreground">{booking.id}</td>
                    <td className="px-4 py-3">
                      {/* Guest name and email are snapshotted onto the booking, so this
                          table needs no call into auth-service. */}
                      <div className="font-medium">{booking.userName}</div>
                      <div className="text-xs text-muted-foreground">{booking.userEmail}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{booking.roomNumber}</div>
                      <div className="text-xs text-muted-foreground">{booking.roomType}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {formatDate(booking.checkInDate)} → {formatDate(booking.checkOutDate)}
                      <div className="text-xs">booked {formatDateTime(booking.createdAt)}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{booking.nights}</td>
                    <td className="px-4 py-3 font-medium">{formatMoney(booking.totalPrice)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={booking.status === 'CONFIRMED' ? 'success' : 'destructive'}>
                        {booking.status === 'CONFIRMED' ? 'Confirmed' : 'Cancelled'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {booking.cancellable ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCancelError(null)
                            setToCancel(booking)
                          }}
                        >
                          <CalendarX className="h-4 w-4 text-destructive" aria-hidden="true" />
                          Cancel
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={Boolean(toCancel)}
        onClose={() => !cancelling && setToCancel(null)}
        title={`Cancel booking #${toCancel?.id ?? ''}?`}
        description={
          toCancel
            ? `${toCancel.userName} · room ${toCancel.roomNumber} · ${formatDate(toCancel.checkInDate)} to ${formatDate(toCancel.checkOutDate)}`
            : undefined
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setToCancel(null)} disabled={cancelling}>
              Keep booking
            </Button>
            <Button variant="destructive" onClick={confirmCancel} loading={cancelling}>
              Cancel booking
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
          You are cancelling on the guest&apos;s behalf. The nights are released immediately and
          the record is kept with a CANCELLED status. This cannot be undone.
        </p>
      </Modal>
    </div>
  )
}
