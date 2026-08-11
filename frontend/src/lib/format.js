const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
})

const shortDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

const chartDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

export function formatMoney(value) {
  const number = Number(value)
  return Number.isFinite(number) ? currency.format(number) : '—'
}

/**
 * Formats an ISO date (yyyy-MM-dd) without going through the local timezone.
 *
 * `new Date('2026-09-14')` is parsed as UTC midnight, so a browser in UTC-5 renders it
 * as 13 September — a booking silently displayed a day early. Splitting the string and
 * constructing a local date avoids that entirely.
 */
export function formatDate(isoDate) {
  if (!isoDate) return '—'
  const [year, month, day] = String(isoDate).split('-').map(Number)
  if (!year || !month || !day) return '—'
  return shortDate.format(new Date(year, month - 1, day))
}

export function formatChartDate(isoDate) {
  if (!isoDate) return ''
  const [year, month, day] = String(isoDate).split('-').map(Number)
  if (!year || !month || !day) return ''
  return chartDate.format(new Date(year, month - 1, day))
}

/** Instants from the API are true timestamps, so normal local rendering is correct. */
export function formatDateTime(instant) {
  if (!instant) return '—'
  const date = new Date(instant)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}

/** Today as yyyy-MM-dd in the user's own timezone, for date input minimums. */
export function todayIso(offsetDays = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function nightsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0
  const start = new Date(`${checkIn}T00:00:00`)
  const end = new Date(`${checkOut}T00:00:00`)
  const diff = Math.round((end - start) / 86_400_000)
  return diff > 0 ? diff : 0
}

export function pluralize(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural ?? `${singular}s`}`
}
