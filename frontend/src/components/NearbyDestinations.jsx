import { Link } from 'react-router-dom'
import { LocateFixed, MapPin, Navigation } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Feedback'
import { pluralize } from '@/lib/format'
import { cn } from '@/lib/utils'

/** "0.4 km away" · "12 km away" · "1,300 km away" — precision that matches the magnitude. */
function formatDistance(km) {
  if (km == null) return null
  if (km < 1) return `${Math.round(km * 1000)} m away`
  if (km < 100) return `${km.toFixed(km < 10 ? 1 : 0)} km away`
  return `${Math.round(km).toLocaleString()} km away`
}

/**
 * Destinations ranked by distance, plus the control that asks for precise coordinates.
 *
 * <p>Deliberately shows the tier-1 (timezone) result first and only escalates to GPS on a
 * click. The permission prompt is the most intrusive thing this app can do, so it happens when
 * the visitor asks for it, not on page load.
 */
export function NearbyDestinations({
  hint,
  matchedCity,
  nearest,
  locating,
  error,
  isPrecise,
  onRequestLocation,
  className,
}) {
  const hasNearest = nearest.length > 0

  return (
    <section className={className}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
            {isPrecise ? 'Closest to you' : 'Where we have hotels'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isPrecise ? (
              <>Ranked by straight-line distance from your location.</>
            ) : matchedCity ? (
              <>
                Your timezone suggests <span className="font-medium text-foreground">{matchedCity.city}</span>
                , where we have {pluralize(matchedCity.hotelCount, 'hotel')}. Share your location for
                exact distances.
              </>
            ) : hint?.city ? (
              <>
                Your timezone suggests{' '}
                <span className="font-medium text-foreground">{hint.city}</span> — we have nothing
                there yet, so here is everywhere we do.
              </>
            ) : (
              <>Every destination here has at least one property you can book.</>
            )}
          </p>
        </div>

        {!isPrecise && (
          <Button variant="outline" onClick={onRequestLocation} loading={locating}>
            <LocateFixed className="h-4 w-4" aria-hidden="true" />
            Use my location
          </Button>
        )}
      </div>

      {/* Permission denial is a choice, not a fault, so it is a warning rather than an error. */}
      {error && (
        <Alert variant="warning" className="mt-4">
          {error}
        </Alert>
      )}

      {hasNearest && (
        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {nearest.map((city, index) => (
            <li key={`${city.city}-${city.country}`}>
              <Link
                to={{ pathname: '/search', search: `city=${encodeURIComponent(city.city)}` }}
                className={cn(
                  'group relative flex items-center gap-3 overflow-hidden rounded-xl border p-3.5 transition-all',
                  index === 0
                    ? 'border-primary/40 bg-primary/5 hover:border-primary/70'
                    : 'border-border bg-card hover:border-primary/40 hover:bg-accent/40',
                )}
              >
                {city.imageUrl ? (
                  <img
                    src={city.imageUrl}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    className="h-14 w-14 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-muted">
                    <MapPin className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  </span>
                )}

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-semibold">{city.city}</span>
                    {index === 0 && (
                      <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-primary">
                        Nearest
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {city.country}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {city.distanceKm != null && (
                      <>
                        <Navigation className="h-3 w-3" aria-hidden="true" />
                        {formatDistance(city.distanceKm)}
                        <span aria-hidden="true">·</span>
                      </>
                    )}
                    {pluralize(city.hotelCount, 'hotel')}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
