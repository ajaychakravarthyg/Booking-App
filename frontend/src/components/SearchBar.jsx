import { useEffect, useState } from 'react'
import { CalendarRange, RotateCcw, Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { Card } from '@/components/ui/Card'
import { nightsBetween, pluralize, todayIso } from '@/lib/format'

const EMPTY = {
  checkIn: '',
  checkOut: '',
  type: '',
  guests: '',
  maxPrice: '',
  q: '',
}

/**
 * Date + attribute filter for the room list.
 *
 * Holds its own draft state and only lifts values on submit, so typing does not fire a
 * request per keystroke. Cross-field date validation happens here too — catching it
 * before the request means the user gets an instant answer instead of a round trip.
 */
export function SearchBar({ initial, roomTypes = [], onSearch, loading }) {
  const [form, setForm] = useState({ ...EMPTY, ...initial })
  const [dateError, setDateError] = useState('')

  useEffect(() => {
    setForm((current) => ({ ...current, ...initial }))
  }, [initial])

  const update = (key) => (event) => {
    const { value } = event.target
    setForm((current) => {
      const next = { ...current, [key]: value }

      // Nudge check-out along when a check-in past it is chosen, rather than leaving an
      // impossible range on screen for the user to untangle.
      if (key === 'checkIn' && next.checkOut && next.checkOut <= value) {
        const dayAfter = new Date(`${value}T00:00:00`)
        dayAfter.setDate(dayAfter.getDate() + 1)
        next.checkOut = dayAfter.toISOString().slice(0, 10)
      }
      return next
    })
    setDateError('')
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    // The API accepts both dates or neither; one alone is a 400.
    const hasOne = Boolean(form.checkIn) !== Boolean(form.checkOut)
    if (hasOne) {
      setDateError('Enter both dates to search by availability, or clear both to see every room.')
      return
    }
    if (form.checkIn && form.checkOut && form.checkOut <= form.checkIn) {
      setDateError('Check-out must be after check-in.')
      return
    }

    setDateError('')
    onSearch(form)
  }

  const handleReset = () => {
    setForm(EMPTY)
    setDateError('')
    onSearch(EMPTY)
  }

  const nights = nightsBetween(form.checkIn, form.checkOut)
  const hasFilters = Object.values(form).some(Boolean)

  return (
    <Card className="p-4 sm:p-5">
      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Check-in" className="min-w-0">
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

          <Field
            label="Check-out"
            className="min-w-0"
            hint={nights > 0 ? pluralize(nights, 'night') : undefined}
          >
            {(props) => (
              <Input
                {...props}
                type="date"
                value={form.checkOut}
                // Cannot precede the chosen check-in; a stay is at least one night.
                min={form.checkIn ? todayIso(1) : todayIso(1)}
                onChange={update('checkOut')}
              />
            )}
          </Field>

          <Field label="Room type" className="min-w-0">
            {(props) => (
              <Select {...props} value={form.type} onChange={update('type')}>
                <option value="">Any type</option>
                {roomTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Guests" className="min-w-0">
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

          <Field label="Max nightly rate" className="min-w-0">
            {(props) => (
              <Input
                {...props}
                type="number"
                inputMode="decimal"
                min="0"
                step="10"
                placeholder="Any"
                value={form.maxPrice}
                onChange={update('maxPrice')}
              />
            )}
          </Field>

          <Field label="Keyword" className="min-w-0 sm:col-span-2">
            {(props) => (
              <Input
                {...props}
                type="search"
                placeholder="Balcony, city view, room number…"
                value={form.q}
                onChange={update('q')}
              />
            )}
          </Field>

          <div className="flex items-end gap-2">
            <Button type="submit" loading={loading} className="flex-1">
              <Search className="h-4 w-4" aria-hidden="true" />
              Search
            </Button>
            {hasFilters && (
              <Button type="button" variant="outline" size="icon" onClick={handleReset} title="Clear filters" aria-label="Clear filters">
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>

        {dateError && (
          <p role="alert" className="mt-3 text-sm font-medium text-destructive">
            {dateError}
          </p>
        )}

        {nights > 0 && !dateError && (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarRange className="h-4 w-4" aria-hidden="true" />
            Showing rooms actually free for {pluralize(nights, 'night')} — anything already
            reserved for these dates is hidden.
          </p>
        )}
      </form>
    </Card>
  )
}
