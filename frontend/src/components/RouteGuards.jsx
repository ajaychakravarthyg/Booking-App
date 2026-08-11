import { Navigate, useLocation } from 'react-router-dom'
import { ShieldX } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { EmptyState, PageLoader } from '@/components/ui/Feedback'
import { buttonClasses } from '@/components/ui/Button'
import { Link } from 'react-router-dom'

/**
 * Requires a signed-in user.
 *
 * Waits for `initializing` before redirecting — otherwise a page refresh on a protected
 * route bounces the user to /login before the stored token has been revalidated.
 *
 * These guards are a UX affordance only. Authorization is enforced by the services; a
 * user who edits their way past this still gets a 401/403 from the API.
 */
export function RequireAuth({ children }) {
  const { isAuthenticated, initializing } = useAuth()
  const location = useLocation()

  if (initializing) return <PageLoader label="Restoring your session" />

  if (!isAuthenticated) {
    // Remember where they were headed so login can send them back.
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return children
}

export function RequireAdmin({ children }) {
  const { isAuthenticated, isAdmin, initializing } = useAuth()
  const location = useLocation()

  if (initializing) return <PageLoader label="Checking your permissions" />

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // Signed in but not an admin: show why rather than silently redirecting, which reads
  // like a broken link.
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState
          icon={ShieldX}
          title="Administrators only"
          description="This area manages rooms, bookings and users across the whole hotel. Your account does not have administrator access."
          action={
            <Link to="/" className={buttonClasses({})}>
              Back to rooms
            </Link>
          }
        />
      </div>
    )
  }
  return children
}
