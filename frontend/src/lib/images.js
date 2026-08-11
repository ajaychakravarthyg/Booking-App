/*
 * Curated Unsplash imagery used for page furniture — heroes, banners and empty states.
 *
 * Room photography itself is NOT here: each room carries its own `imageUrl` from
 * room-service, so the catalog stays editable by an admin rather than hard-coded in the
 * frontend. These are only the decorative images that belong to the app's chrome.
 *
 * All are hotlinked with Unsplash's resizing parameters so the browser fetches an
 * appropriately-sized file instead of a multi-megabyte original.
 */

const UNSPLASH = 'https://images.unsplash.com/photo-'

/** Builds a sized, cropped Unsplash URL. */
function img(photoId, width = 1600, height = null) {
  const crop = height ? `&h=${height}` : ''
  return `${UNSPLASH}${photoId}?auto=format&fit=crop&w=${width}${crop}&q=80`
}

/** Wide hotel exterior/lobby shots for page headers. */
export const HERO = {
  /** Guest-facing room search header. */
  rooms: img('1566073771259-6a8506099945', 1920, 620),
  /** Admin dashboard banner — a front-desk / operations feel rather than a guest room. */
  admin: img('1551882547-ff40c63fe5fa', 1920, 420),
  /** Room inventory management. */
  inventory: img('1631049307264-da0ec9d70304', 1600, 360),
  /** Reservations list. */
  reservations: img('1554995207-c18c203602cb', 1600, 360),
  /** User management. */
  guests: img('1600585154340-be6161a56a0c', 1600, 360),
}

/**
 * Rotating travel photography for the auth pages — deliberately world-spanning rather than
 * hotel interiors, because signing in is about the trip, not the room.
 */
export const AUTH_GALLERY = [
  { src: img('1512453979798-5ea266f8880c', 1200, 1600), place: 'Lisbon', country: 'Portugal' },
  { src: img('1578469645742-46cae010e5d4', 1200, 1600), place: 'Kyoto', country: 'Japan' },
  { src: img('1504893524553-b855bce32c67', 1200, 1600), place: 'Reykjavík', country: 'Iceland' },
  { src: img('1597212618440-806262de4f6b', 1200, 1600), place: 'Marrakesh', country: 'Morocco' },
  { src: img('1506377247377-2a5b3b417ebb', 1200, 1600), place: 'Edinburgh', country: 'Scotland' },
  { src: img('1580060839134-75a5edca2e99', 1200, 1600), place: 'Cape Town', country: 'South Africa' },
]

/** Shown when a room has no image, or its URL fails to load. */
export const ROOM_PLACEHOLDER = img('1595576508898-0ad5c879a061', 800, 600)

/** Small square crop for table rows and compact lists. */
export function thumbnail(url, size = 96) {
  if (!url) return null
  // Only Unsplash URLs can be re-parameterised; anything else is returned untouched so a
  // custom image an admin pasted still renders.
  if (!url.includes('images.unsplash.com')) return url
  const [base] = url.split('?')
  return `${base}?auto=format&fit=crop&w=${size}&h=${size}&q=70`
}
