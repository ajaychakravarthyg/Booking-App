import { useCallback, useEffect, useState } from 'react'
import { citiesApi } from '@/lib/api'

/*
 * Two-tier location detection.
 *
 * TIER 1 — instant, zero permission, zero network.
 *   The browser already tells us roughly where it is, for free: the IANA timezone
 *   ("Europe/Lisbon") names a city, and navigator.language carries a region ("pt-PT").
 *   Neither needs a permission prompt, an IP-geolocation vendor, or a round trip. It is
 *   coarse — a whole timezone wide — but it is enough to say "looks like you're in Portugal"
 *   and preselect a destination the moment the page paints.
 *
 * TIER 2 — precise, only on an explicit click.
 *   navigator.geolocation gives real coordinates, which the backend turns into
 *   distance-ranked destinations. It is deliberately NOT called on mount: a permission
 *   prompt nobody asked for is hostile, and browsers increasingly ignore or penalise it.
 *
 * Why not IP geolocation: it needs a third-party service on every page load, which means an
 * external dependency, a rate limit, a privacy disclosure, and something else to fail. The
 * timezone heuristic gets most of the benefit with none of that.
 */

/**
 * Extracts a plausible city from an IANA timezone id.
 *
 * "Europe/Lisbon" → "Lisbon"; "America/New_York" → "New York"; "Asia/Tokyo" → "Tokyo".
 * Returns null for ids that name no city ("UTC", "Etc/GMT+3").
 */
function cityFromTimeZone(timeZone) {
  if (!timeZone || !timeZone.includes('/')) return null

  const last = timeZone.split('/').pop()
  if (!last || last.startsWith('GMT') || last === 'UTC' || last === 'Unknown') return null

  return last.replace(/_/g, ' ')
}

/** Region subtag from the browser locale: "pt-PT" → "PT", "en" → null. */
function regionFromLocale(locale) {
  if (!locale) return null
  const parts = locale.split('-')
  // A 2-letter uppercase subtag is the region; the 3-letter form is numeric UN M49.
  const region = parts.find((part) => /^[A-Z]{2}$/.test(part))
  return region ?? null
}

export function useDetectedLocation() {
  // Tier 1 runs synchronously on first render — no loading state, nothing to await.
  const [hint, setHint] = useState(() => {
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
      return {
        timeZone,
        city: cityFromTimeZone(timeZone),
        region: regionFromLocale(navigator.language),
        source: 'timezone',
      }
    } catch {
      // Intl is universally available, but a locked-down environment could still throw.
      return { timeZone: null, city: null, region: null, source: 'none' }
    }
  })

  /** A destination we actually sell that matches the tier-1 hint, once cities load. */
  const [matchedCity, setMatchedCity] = useState(null)

  /** Tier-2 state. */
  const [coords, setCoords] = useState(null)
  const [nearest, setNearest] = useState([])
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState(null)

  // Resolve the timezone city against the real destination list. A match is a strong signal;
  // no match simply means we have nothing where the visitor is, which is expected.
  useEffect(() => {
    if (!hint.city) return
    let cancelled = false

    citiesApi
      .list()
      .then(({ data }) => {
        if (cancelled) return
        const needle = hint.city.toLowerCase()
        const exact = data.find((c) => c.city.toLowerCase() === needle)
        setMatchedCity(exact ?? null)
      })
      .catch(() => {
        /* Destination list unavailable — the hint just stays unmatched. */
      })

    return () => {
      cancelled = true
    }
  }, [hint.city])

  /**
   * Tier 2. Must be called from a user gesture — browsers require it, and asking without one
   * is the behaviour that got permission prompts throttled in the first place.
   */
  const requestPreciseLocation = useCallback(() => {
    setError(null)

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('This browser cannot share your location.')
      return
    }
    // Geolocation is gated on a secure context, so it silently fails over plain http on a
    // LAN address. Saying so beats an unexplained timeout.
    if (!window.isSecureContext) {
      setError(
        'Sharing your location needs a secure (https) connection. Pick a destination manually instead.',
      )
      return
    }

    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const point = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMetres: position.coords.accuracy,
        }
        setCoords(point)
        try {
          const { data } = await citiesApi.nearest({
            lat: point.latitude,
            lng: point.longitude,
            limit: 6,
          })
          setNearest(data)
          setHint((current) => ({ ...current, source: 'gps' }))
        } catch {
          setError('Found your location, but could not load nearby destinations.')
        } finally {
          setLocating(false)
        }
      },
      (positionError) => {
        setLocating(false)
        // Each case gets its own message: "denied" is the user's choice and should not read
        // like a fault, whereas a timeout is worth retrying.
        const messages = {
          1: 'Location permission was declined. You can still search by typing a city.',
          2: 'Your location is unavailable right now. Try typing a city instead.',
          3: 'Finding your location took too long. Try again, or type a city.',
        }
        setError(messages[positionError.code] ?? 'Could not determine your location.')
      },
      {
        // 10s is long enough for a cold GPS fix without leaving a spinner running forever.
        timeout: 10_000,
        // A cached fix up to 5 minutes old is fine — nobody changes city in that window,
        // and reusing it avoids waking the GPS radio.
        maximumAge: 300_000,
        // City-level accuracy is all a hotel search needs, and the low-power network
        // provider answers far faster than satellite.
        enableHighAccuracy: false,
      },
    )
  }, [])

  return {
    /** Coarse guess available immediately: { timeZone, city, region, source }. */
    hint,
    /** The tier-1 city if it is a destination we actually sell, else null. */
    matchedCity,
    /** Precise coordinates, once granted. */
    coords,
    /** Destinations ranked by distance from those coordinates. */
    nearest,
    locating,
    error,
    requestPreciseLocation,
    /** True once the visitor has shared precise coordinates. */
    isPrecise: hint.source === 'gps',
  }
}
