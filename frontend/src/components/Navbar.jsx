import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { CalendarCheck, Hotel, LayoutDashboard, LogOut, Menu, User, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button, buttonClasses } from '@/components/ui/Button'
import { ThemeToggle } from './ThemeToggle'
import { cn } from '@/lib/utils'

export function Navbar() {
  const { isAuthenticated, isAdmin, user, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  // Collapse the mobile menu on navigation, otherwise it stays open over the new page.
  useEffect(() => setMobileOpen(false), [location.pathname])

  const handleLogout = () => {
    logout()
    navigate('/', { replace: true })
  }

  const links = [
    { to: '/', label: 'Rooms', icon: Hotel, end: true },
    ...(isAuthenticated ? [{ to: '/my-bookings', label: 'My bookings', icon: CalendarCheck }] : []),
    ...(isAdmin ? [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard }] : []),
  ]

  const navLinkClass = ({ isActive }) =>
    cn(
      'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
      isActive
        ? 'bg-accent text-accent-foreground'
        : 'text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground',
    )

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <nav
        className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"
        aria-label="Main"
      >
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Hotel className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-base font-bold tracking-tight">Aurora Grand</span>
            <span className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
              Hotel &amp; Suites
            </span>
          </span>
        </Link>

        {/* Desktop */}
        <div className="hidden items-center gap-1 md:flex">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={navLinkClass}>
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          {isAuthenticated ? (
            <>
              <span className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm">
                <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <span className="max-w-[10rem] truncate font-medium">{user?.name}</span>
                {isAdmin && (
                  <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-primary">
                    Admin
                  </span>
                )}
              </span>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Link to="/login" className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
                Sign in
              </Link>
              <Link to="/register" className={buttonClasses({ size: 'sm' })}>
                Create account
              </Link>
            </>
          )}
        </div>

        {/* Mobile trigger */}
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen((open) => !open)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </Button>
        </div>
      </nav>

      {mobileOpen && (
        <div id="mobile-menu" className="border-t border-border bg-card px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {links.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={navLinkClass}>
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </div>

          <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
            {isAuthenticated ? (
              <>
                <p className="px-3 text-sm text-muted-foreground">
                  Signed in as <span className="font-medium text-foreground">{user?.email}</span>
                </p>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <Link to="/login" className={buttonClasses({ variant: 'outline', size: 'sm' })}>
                  Sign in
                </Link>
                <Link to="/register" className={buttonClasses({ size: 'sm' })}>
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
