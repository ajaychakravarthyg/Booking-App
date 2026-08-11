import { useEffect, useMemo, useRef, useState } from 'react'
import { MapPin, Search } from 'lucide-react'
import { citiesApi } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { nightsBetween, pluralize, todayIso } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Destination + dates + guests.
 *
 * <p>The city field is a combobox over `/api/cities`, not free text. That matters: the
 * backend matches city exactly (a LIKE would make "York" also return New York), so the form
 * must only ever submit a real destination. Typing something unrecognised is rejected here
 * with a suggestion rather than sent off to return zero results.
 */
export function CitySearchForm({ initial, onSearch, loading, compact = false }) {
  const [form, setForm] = useState({
    city: initial?.city ?? '',
    checkIn: initial?.checkIn ?? '',
    checkOut: initial?.checkOut ?? '',
    guests: initial?.guests ?? '',
  })
  const [cities, setCities] = useState([])
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [error, setError] = useState('')
  const wrapperRef = useRef(null)

  useEffect(() => {
    setForm((current) => ({ ...current, ...initial }))
  }, [initial])

  // Fetched once and filtered in memory: the destination list is small and changes only
  // when an admin adds a hotel, so a request per keystroke would be pure waste. The
  // endpoint also sends a 5-minute cache header for the same reason.
  useEffect(() => {
    citiesApi
      .list()
      .then(({ data }) => setCities(data))
      .catch(() => setCities([]))
  }, [])

  // Close the dropdown on an outside click, or it hangs over the rest of the page.
  useEffect(() => {
    const onPointerDown = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  const matches = useMemo(() => {
    const term = form.city.trim().toLowerCase()
    if (!term) return cities.slice(0, 8)
    return cities
      .filter(
        (c) =>
          c.city.toLowerCase().includes(term) || c.country.toLowerCase().includes(term),
      )
      .slice(0, 8)
  }, [cities, form.city])

  const update = (key) => (event) => {
    const { value } = event.target
    setForm((current) => {
      const next = { ...current, [key]: value }
      // Keep check-out after check-in rather than leaving an impossible range on screen.
      if (key === 'checkIn' && next.checkOut && next.checkOut <= value) {
        const dayAfter = new Date(`${value}T00:00:00`)
        dayAfter.setDate(dayAfter.getDate() + 1)
        next.checkOut = dayAfter.toISOString().slice(0, 10)
      }
      return next
    })
    setError('')
  }

  const chooseCity = (city) => {
    setForm((current) => ({ ...current, city: city.city }))
    setOpen(false)
    setError('')
  }

  const onCityKeyDown = (event) => {
    if (!open || matches.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlight((h) => (h + 1) % matches.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlight((h) => (h - 1 + matches.length) % matches.length)
    } else if (event.key === 'Enter') {
      // Enter picks the highlighted suggestion instead of submitting a half-typed city.
      event.preventDefault()
      chooseCity(matches[highlight])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const typed = form.city.trim()

    if (!typed) {
      setError('Choose a destination to search.')
      return
    }

    // The API matches city exactly, so resolve what was typed against the real list first.
    // Case-insensitive, and a unique partial match is accepted so "lisb" still works.
    const exact = cities.find((c) => c.city.toLowerCase() === typed.toLowerCase())
    const partial = cities.filter((c) => c.city.toLowerCase().startsWith(typed.toLowerCase()))
    const resolved = exact ?? (partial.length === 1 ? partial[0] : null)

    if (!resolved) {
      setError(
        cities.length > 0
          ? `We do not have hotels in "${typed}" yet. Try ${cities
              .slice(0, 3)
              .map((c) => c.city)
              .join(', ')}.`
          : 'Destinations could not be loaded. Please try again.',
      )
      return
    }

    if (Boolean(form.checkIn) !== Boolean(form.checkOut)) {
      setError('Enter both dates, or leave both blank to see everything in the city.')
      return
    }
    if (form.checkIn && form.checkOut && form.checkOut <= form.checkIn) {
      setError('Check-out must be after check-in.')
      return
    }

    onSearch({ ...form, city: resolved.city })
  }

  const nights = nightsBetween(form.checkIn, form.checkOut)

  return (
    <form onSubmit={handleSubmit} noValidate className={cn(!compact && 'text-left')}>
      <div
        className={cn(
          'grid gap-3',
          compact ? 'sm:grid-cols-2 lg:grid-cols-5' : 'sm:grid-cols-2 lg:grid-cols-5',
        )}
      >
        {/* ── Destination combobox ─────────────────────────────────────────────── */}
        <div ref={wrapperRef} className="relative lg:col-span-2">
          <Field label="Destination" required>
            {(props) => (
              <Input
                {...props}
                role="combobox"
                aria-expanded={open}
                aria-autocomplete="list"
                autoComplete="off"
                placeholder="Where are you going?"
                value={form.city}
                onChange={(event) => {
                  update('city')(event)
                  setOpen(true)
                  setHighlight(0)
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={onCityKeyDown}
              />
            )}
          </Field>

          {open && matches.length > 0 && (
            <ul
              role="listbox"
              className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-popover p-1 shadow-xl"
            >
              {matches.map((city, index) => (
                <li key={`${city.city}-${city.country}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === highlight}
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => chooseCity(city)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                      index === highlight ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60',
                    )}
                  >
                    <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{city.city}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {city.country}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {pluralize(city.hotelCount, 'hotel')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Field label="Check-in">
          {(props) => (
            <Input
              {...props}
              type="date"
              value={form.checkIn}
              min={todayIso()}
              onChange={update('checkIn')}
            />
          )}
        </Field>

        <Field label="Check-out" hint={nights > 0 ? pluralize(nights, 'night') : undefined}>
          {(props) => (
            <Input
              {...props}
              type="date"
              value={form.checkOut}
              min={form.checkIn || todayIso(1)}
              onChange={update('checkOut')}
            />
          )}
        </Field>

        <Field label="Guests">
          {(props) => (
            <Select {...props} value={form.guests} onChange={update('guests')}>
              <option value="">Any</option>
              {[1, 2, 3, 4, 5, 6].map((count) => (
                <option key={count} value={count}>
                  {pluralize(count, 'guest')}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {error ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {nights > 0
              ? `Only hotels with a room actually free for ${pluralize(nights, 'night')} are shown.`
              : 'Add dates to see real availability and stay totals.'}
          </p>
        )}

        <Button type="submit" loading={loading} size="lg" className="sm:w-44">
          <Search className="h-4 w-4" aria-hidden="true" />
          Search hotels
        </Button>
      </div>
    </form>
  )
}
