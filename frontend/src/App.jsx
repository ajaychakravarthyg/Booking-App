import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'
import { RequireAdmin, RequireAuth } from '@/components/RouteGuards'
import { PageLoader } from '@/components/ui/Feedback'
import Home from '@/pages/Home'
import HotelResults from '@/pages/HotelResults'
import HotelDetails from '@/pages/HotelDetails'
import RoomDetails from '@/pages/RoomDetails'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import NotFound from '@/pages/NotFound'

// Code-split the two heaviest routes. The admin dashboard pulls in Recharts, which a
// guest browsing rooms should never have to download.
const MyBookings = lazy(() => import('@/pages/MyBookings'))
const AdminDashboard = lazy(() => import('@/pages/AdminDashboard'))

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* First tab stop, for keyboard users who would otherwise traverse the whole nav. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <Navbar />

      <main id="main" className="flex-1">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* city → hotels → rooms → book */}
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<HotelResults />} />
            <Route path="/hotels/:id" element={<HotelDetails />} />
            <Route path="/rooms/:id" element={<RoomDetails />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route
              path="/my-bookings"
              element={
                <RequireAuth>
                  <MyBookings />
                </RequireAuth>
              }
            />

            <Route
              path="/admin"
              element={
                <RequireAdmin>
                  <AdminDashboard />
                </RequireAdmin>
              }
            />

            {/* Legacy paths kept working rather than 404ing anyone's bookmark. /rooms was
                the room list before the catalogue grew to multiple properties. */}
            <Route path="/rooms" element={<Navigate to="/search" replace />} />
            <Route path="/hotels" element={<Navigate to="/search" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>

      <footer className="border-t border-border py-6">
        <div className="mx-auto max-w-7xl px-4 text-center text-xs text-muted-foreground sm:px-6 lg:px-8">
          <p>
            A 3-tier microservices hotel booking platform. React → API gateway → auth / room /
            booking services → PostgreSQL.
          </p>
          <p className="mt-1">
            The browser only ever talks to the gateway; it has no database access of any kind.
          </p>
        </div>
      </footer>
    </div>
  )
}
