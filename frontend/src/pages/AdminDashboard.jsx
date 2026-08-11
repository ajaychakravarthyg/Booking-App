import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  BedDouble,
  CalendarCheck,
  CalendarRange,
  DollarSign,
  LayoutDashboard,
  Users,
} from 'lucide-react'
import { bookingsApi, normalizeError, roomsApi, usersApi } from '@/lib/api'
import { StatCard } from '@/components/admin/StatCard'
import { ArrivalsChart, RevenueChart, RoomTypeChart } from '@/components/admin/DashboardCharts'
import { RoomsPanel } from '@/components/admin/RoomsPanel'
import { BookingsPanel } from '@/components/admin/BookingsPanel'
import { UsersPanel } from '@/components/admin/UsersPanel'
import { Alert, PageLoader } from '@/components/ui/Feedback'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'rooms', label: 'Rooms', icon: BedDouble },
  { id: 'bookings', label: 'Bookings', icon: CalendarRange },
  { id: 'users', label: 'Users', icon: Users },
]

export default function AdminDashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = TABS.some((tab) => tab.id === searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'overview'

  const [stats, setStats] = useState({ bookings: null, rooms: null, users: null })
  const [roomTypes, setRoomTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [partialErrors, setPartialErrors] = useState([])

  /*
   * The dashboard is assembled from three independent services, one call each.
   *
   * This is the composition point of the whole architecture: no service reaches into
   * another's schema to build a cross-domain summary, so the client is what joins them.
   *
   * allSettled rather than all — if room-service is cold-starting, the booking figures
   * and the user counts should still render instead of the page failing whole.
   */
  const loadStats = useCallback(async () => {
    setLoading(true)
    const [bookingsResult, roomsResult, usersResult] = await Promise.allSettled([
      bookingsApi.stats(),
      roomsApi.stats(),
      usersApi.stats(),
    ])

    const failures = []
    const next = { bookings: null, rooms: null, users: null }

    if (bookingsResult.status === 'fulfilled') next.bookings = bookingsResult.value.data
    else failures.push(`Bookings: ${normalizeError(bookingsResult.reason).message}`)

    if (roomsResult.status === 'fulfilled') next.rooms = roomsResult.value.data
    else failures.push(`Rooms: ${normalizeError(roomsResult.reason).message}`)

    if (usersResult.status === 'fulfilled') next.users = usersResult.value.data
    else failures.push(`Users: ${normalizeError(usersResult.reason).message}`)

    setStats(next)
    setPartialErrors(failures)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadStats()
    roomsApi
      .types()
      .then(({ data }) => setRoomTypes(data))
      .catch(() => setRoomTypes([]))
  }, [loadStats])

  // Tab lives in the URL so a reload keeps you where you were.
  const setTab = (tab) => setSearchParams(tab === 'overview' ? {} : { tab }, { replace: true })

  const { bookings, rooms, users } = stats

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Admin dashboard</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Figures below are composed in the browser from three separate services — auth, rooms
          and bookings — each queried independently.
        </p>
      </header>

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border" role="tablist">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={activeTab === id}
            onClick={() => setTab(id)}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              activeTab === id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          {partialErrors.length > 0 && (
            <Alert
              variant="warning"
              title="Some figures could not be loaded"
              onRetry={loadStats}
              className="mb-5"
            >
              <ul className="list-inside list-disc">
                {partialErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </Alert>
          )}

          {loading ? (
            <PageLoader label="Loading dashboard" />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Confirmed bookings"
                  value={bookings?.confirmedBookings ?? '—'}
                  hint={
                    bookings
                      ? `${bookings.cancelledBookings} cancelled of ${bookings.totalBookings} total`
                      : undefined
                  }
                  icon={CalendarCheck}
                  tone="success"
                />
                <StatCard
                  label="Revenue"
                  value={bookings ? formatMoney(bookings.totalRevenue) : '—'}
                  hint={
                    bookings ? `${formatMoney(bookings.averageBookingValue)} average booking` : undefined
                  }
                  icon={DollarSign}
                  tone="primary"
                />
                <StatCard
                  label="Upcoming arrivals"
                  value={bookings?.upcomingArrivals ?? '—'}
                  hint="Confirmed stays starting today or later"
                  icon={CalendarRange}
                  tone="warning"
                />
                <StatCard
                  label="Rooms"
                  value={rooms?.totalRooms ?? '—'}
                  hint={
                    rooms
                      ? `${rooms.availableRooms} in service · ${rooms.outOfServiceRooms} out`
                      : undefined
                  }
                  icon={BedDouble}
                  tone="muted"
                />
              </div>

              <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
                <ArrivalsChart data={bookings?.arrivalsPerDay} />
                <RoomTypeChart data={rooms?.byType} />
              </div>

              <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <RevenueChart data={bookings?.arrivalsPerDay} />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  <StatCard
                    label="Registered users"
                    value={users?.totalUsers ?? '—'}
                    hint={users ? `${users.admins} admin · ${users.customers} customer` : undefined}
                    icon={Users}
                    tone="primary"
                  />
                  {rooms && (
                    <StatCard
                      label="Nightly rate range"
                      value={`${formatMoney(rooms.lowestPricePerNight)} – ${formatMoney(rooms.highestPricePerNight)}`}
                      hint={`${formatMoney(rooms.averagePricePerNight)} average`}
                      icon={DollarSign}
                      tone="muted"
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {activeTab === 'rooms' && <RoomsPanel roomTypes={roomTypes} onChanged={loadStats} />}
      {activeTab === 'bookings' && <BookingsPanel onChanged={loadStats} />}
      {activeTab === 'users' && <UsersPanel onChanged={loadStats} />}
    </div>
  )
}
