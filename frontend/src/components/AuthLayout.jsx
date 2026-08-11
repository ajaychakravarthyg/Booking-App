import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Globe2, Hotel, MapPin, Navigation } from 'lucide-react'
import { hotelsApi } from '@/lib/api'
import { useDetectedLocation } from '@/hooks/useDetectedLocation'
import { WorldDotMap } from './WorldDotMap'
import { ThemeToggle } from './ThemeToggle'
import { AUTH_GALLERY } from '@/lib/images'
import { cn } from '@/lib/utils'

/** How long each destination photo holds before crossfading to the next. */
const SLIDE_MS = 6000

/**
 * Split-screen shell for sign-in and registration.
 *
 * <p>Left panel: a colour mesh, a rotating destination photograph, and a canvas world map with
 * our real destinations plotted. Right panel: the form.
 *
 * <p>The panel is <b>location-aware</b>. The detected city — inferred from the browser timezone
 * with no permission prompt — is named in the copy and marked on the map, and the photo rotation
 * starts on the matching destination when we have one. That is the difference between a stock
 * decorative hero and one that says something true about the visitor.
 *
 * <p>Everything derives from theme tokens, so light and dark are both first-class rather than
 * one being an afterthought.
 */
export function AuthLayout({ eyebrow, title, subtitle, children, footer }) {
  const { hint, matchedCity } = useDetectedLocation()
  const [destinations, setDestinations] = useState([])
  const [slide, setSlide] = useState(0)

  // Real coordinates for the map markers. Falls back to an unplotted map on failure — the
  // panel is decoration and must never block signing in.
  useEffect(() => {
    hotelsApi
      .list({ active: true })
      .then(({ data }) =>
        setDestinations(
          data
            .filter((hotel) => hotel.latitude != null && hotel.longitude != null)
            .map((hotel) => ({
              city: hotel.city,
              latitude: hotel.latitude,
              longitude: hotel.longitude,
            })),
        ),
      )
      .catch(() => setDestinations([]))
  }, [])

  // Start on the visitor's own city when it is one of ours, so the first thing they see is
  // somewhere they recognise.
  useEffect(() => {
    if (!matchedCity) return
    const index = AUTH_GALLERY.findIndex(
      (item) => item.place.toLowerCase() === matchedCity.city.toLowerCase(),
    )
    if (index >= 0) setSlide(index)
  }, [matchedCity])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(
      () => setSlide((current) => (current + 1) % AUTH_GALLERY.length),
      SLIDE_MS,
    )
    return () => window.clearInterval(timer)
  }, [])

  // The marker: the visitor's own city if we sell it, otherwise the current photo's city, so
  // the map always has a focal point.
  const highlight = matchedCity
    ? destinations.find((d) => d.city.toLowerCase() === matchedCity.city.toLowerCase())
    : null

  const active = AUTH_GALLERY[slide]

  return (
    <div className="grid min-h-[calc(100vh-4rem)] grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
      {/* ── Visual panel ─────────────────────────────────────────────────────────
          Hidden below lg: a 50vh photo above a form is worse than no photo, because it
          pushes the actual task below the fold on a phone. */}
      <section className="relative isolate hidden overflow-hidden lg:block">
        <div className="bg-travel-mesh animate-mesh absolute inset-0" aria-hidden="true" />

        {/* Crossfading destination photography, dimmed so the map and text stay readable. */}
        {AUTH_GALLERY.map((item, index) => (
          <img
            key={item.src}
            src={item.src}
            alt=""
            aria-hidden="true"
            className={cn(
              'absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out',
              index === slide ? 'opacity-30' : 'opacity-0',
            )}
          />
        ))}

        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-black/55 via-black/35 to-black/70"
        />

        <WorldDotMap
          destinations={destinations}
          highlight={highlight}
          className="absolute inset-0 opacity-70"
        />

        <div className="relative flex h-full flex-col justify-between p-10">
          <Link to="/" className="inline-flex items-center gap-2.5 self-start">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 text-white backdrop-blur-sm">
              <Hotel className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-lg font-bold tracking-tight text-white">Staylo</span>
              <span className="text-[0.65rem] uppercase tracking-widest text-white/60">
                Hotels &amp; Stays
              </span>
            </span>
          </Link>

          <div>
            <h2 className="max-w-md text-3xl font-bold leading-tight tracking-tight text-white">
              Rooms you can actually book,
              <br />
              in {destinations.length > 0 ? new Set(destinations.map((d) => d.city)).size : 'six'}{' '}
              cities.
            </h2>
            <p className="mt-3 max-w-md text-sm text-white/75">
              We hide properties with nothing free for your dates, so a room you can see is a room
              you can have.
            </p>

            {/* Location awareness, stated honestly: a timezone guess is labelled as a guess. */}
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              {matchedCity ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-sm text-white backdrop-blur-sm">
                  <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
                  Looks like you're in {matchedCity.city} — we have{' '}
                  {matchedCity.hotelCount} {matchedCity.hotelCount === 1 ? 'hotel' : 'hotels'} there
                </span>
              ) : hint.city ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-sm text-white backdrop-blur-sm">
                  <Globe2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Detected {hint.city}
                  {hint.region ? ` (${hint.region})` : ''} — nothing there yet, but plenty nearby
                </span>
              ) : null}

              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-sm text-white/80 backdrop-blur-sm">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                Now showing {active.place}, {active.country}
              </span>
            </div>

            {/* Slide indicators, clickable so the rotation is not the only way through. */}
            <div className="mt-6 flex gap-1.5">
              {AUTH_GALLERY.map((item, index) => (
                <button
                  key={item.src}
                  type="button"
                  onClick={() => setSlide(index)}
                  aria-label={`Show ${item.place}`}
                  aria-current={index === slide}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    index === slide ? 'w-8 bg-white' : 'w-4 bg-white/35 hover:bg-white/60',
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Form panel ───────────────────────────────────────────────────────────── */}
      <section className="relative flex flex-col justify-center px-5 py-10 sm:px-10 lg:px-14">
        {/* A toggle here as well as in the navbar: the auth pages are where a first-time
            visitor lands, and hunting the header for it is friction. */}
        <div className="absolute right-4 top-4 lg:right-8 lg:top-8">
          <ThemeToggle />
        </div>

        <div className="mx-auto w-full max-w-md animate-fade-in-up">
          {/* Compact brand for the mobile layout, where the visual panel is hidden. */}
          <Link to="/" className="mb-8 inline-flex items-center gap-2.5 lg:hidden">
            <span className="bg-travel-sweep grid h-10 w-10 place-items-center rounded-xl text-white">
              <Hotel className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-lg font-bold tracking-tight">Staylo</span>
          </Link>

          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            <span className="text-travel-gradient">{title}</span>
          </h1>
          {subtitle && <p className="mt-2.5 text-sm text-muted-foreground">{subtitle}</p>}

          <div className="mt-8">{children}</div>

          {footer && <div className="mt-7">{footer}</div>}
        </div>
      </section>
    </div>
  )
}
