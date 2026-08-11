import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Building2, ShieldCheck, Sparkles } from 'lucide-react'
import { citiesApi } from '@/lib/api'
import { CitySearchForm } from '@/components/CitySearchForm'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Feedback'
import { HERO } from '@/lib/images'
import { pluralize } from '@/lib/format'

/** Drops empty values so they never become `?guests=` in the URL. */
function compact(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== '' && value != null),
  )
}

export default function Home() {
  const navigate = useNavigate()
  const [cities, setCities] = useState([])
  const [loadingCities, setLoadingCities] = useState(true)

  useEffect(() => {
    citiesApi
      .list()
      .then(({ data }) => setCities(data))
      .catch(() => setCities([]))
      .finally(() => setLoadingCities(false))
  }, [])

  // The search form owns validation; this just turns a valid query into a URL, so the
  // results page can be linked, shared and reloaded.
  const handleSearch = (form) => navigate({ pathname: '/search', search: new URLSearchParams(compact(form)).toString() })

  return (
    <div>
      {/* ── Hero with the search form overlaid ─────────────────────────────────── */}
      <section className="relative isolate">
        <img
          src={HERO.rooms}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80"
        />

        <div className="relative mx-auto max-w-5xl px-4 py-14 text-center sm:px-6 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
            {loadingCities
              ? 'Loading destinations'
              : `${pluralize(cities.length, 'destination')} · ${pluralize(
                  cities.reduce((sum, c) => sum + c.hotelCount, 0),
                  'hotel',
                )}`}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-5xl">
            Find a room that is actually free
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-white/85 sm:text-base">
            Search a city and your dates. Properties with nothing available for those nights are
            filtered out before you see them — no clicking through to discover a room is gone.
          </p>

          <Card className="mt-8 p-5 text-left sm:p-6">
            <CitySearchForm onSearch={handleSearch} />
          </Card>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* ── Destinations ─────────────────────────────────────────────────────── */}
        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                Where we have hotels
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                This list is derived from the properties themselves, so every destination here
                has something to book.
              </p>
            </div>
          </div>

          {loadingCities ? (
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="aspect-[4/5] rounded-xl" />
              ))}
            </div>
          ) : cities.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">
              No destinations yet — an administrator needs to add a hotel first.
            </p>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {cities.map((city) => (
                <Link
                  key={`${city.city}-${city.country}`}
                  to={{ pathname: '/search', search: `city=${encodeURIComponent(city.city)}` }}
                  className="group relative isolate block aspect-[4/5] overflow-hidden rounded-xl border border-border bg-muted"
                >
                  {city.imageUrl && (
                    <img
                      src={city.imageUrl}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  )}
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent"
                  />
                  <div className="relative flex h-full flex-col justify-end p-3">
                    <p className="font-semibold leading-tight text-white">{city.city}</p>
                    <p className="text-xs text-white/75">{city.country}</p>
                    <p className="mt-1 text-xs text-white/60">
                      {pluralize(city.hotelCount, 'hotel')}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ── How it differs ───────────────────────────────────────────────────── */}
        <section className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {[
            {
              icon: Sparkles,
              title: 'Real availability, not a catalogue',
              body: 'Results come from the booking service, which subtracts every overlapping reservation. A room you can see is a room you can book.',
            },
            {
              icon: Building2,
              title: 'Prices that mean something',
              body: 'The "from" price is the cheapest room still free for your dates — not a headline rate belonging to a room someone else already took.',
            },
            {
              icon: ShieldCheck,
              title: 'No double bookings',
              body: 'Concurrent attempts on the same room are serialised, and PostgreSQL itself rejects overlapping stays. Load-tested at 80 simultaneous requests.',
            },
          ].map(({ icon: Icon, title, body }) => (
            <Card key={title} className="p-5">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/12 text-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-3.5 font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
            </Card>
          ))}
        </section>

        <section className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-5">
          <div>
            <h2 className="font-semibold">Browse every room instead</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Prefer to look across all properties at once? The full catalogue is there too.
            </p>
          </div>
          <Link
            to="/search"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            See all destinations
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>
      </div>
    </div>
  )
}
