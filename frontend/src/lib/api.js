import axios from 'axios'

export const TOKEN_KEY = 'hb.token'
export const USER_KEY = 'hb.user'

/*
 * Every call goes through the API gateway. The frontend never knows that auth, rooms
 * and bookings are three separate services, and it certainly never touches a database —
 * that is the whole point of the tiering.
 *
 * In development the base URL is left empty so requests go to /api on the Vite dev
 * server, which proxies them to the gateway. Same-origin, so no CORS in the loop.
 */
const baseURL = import.meta.env.VITE_API_BASE_URL ?? ''

export const api = axios.create({
  baseURL,
  // Generous: a free-tier backend waking from sleep can genuinely take this long.
  timeout: 60_000,
  headers: { 'Content-Type': 'application/json' },
})

let onUnauthorized = null

/** Lets AuthContext react to a rejected token without importing React state here. */
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

api.interceptors.request.use((config) => {
  const token = getStoredToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

const RETRY_LIMIT = 2
const RETRYABLE_STATUSES = [502, 503, 504]

function isRetryable(error) {
  // A timeout or dropped connection has no response at all.
  if (!error.response) {
    return error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK'
  }
  return RETRYABLE_STATUSES.includes(error.response.status)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config ?? {}

    // The token was rejected. Hand off to AuthContext to clear session state and
    // bounce to the login screen, so the user is not left staring at empty lists.
    if (error.response?.status === 401 && !config.__skipAuthRedirect) {
      onUnauthorized?.()
      return Promise.reject(normalizeError(error))
    }

    /*
     * Retry idempotent reads when the backend is briefly unreachable.
     *
     * This is specifically for free-tier hosting: services sleep after inactivity and
     * the gateway answers the first request with a 503 while they wake. Retrying turns
     * that into a slow success instead of a visible error.
     *
     * Deliberately limited to GET — replaying a POST could create a second booking.
     */
    const method = (config.method ?? 'get').toLowerCase()
    config.__retryCount = config.__retryCount ?? 0

    if (method === 'get' && isRetryable(error) && config.__retryCount < RETRY_LIMIT) {
      config.__retryCount += 1
      // 1.5s then 4s — long enough to matter for a cold start, short enough to feel alive.
      await sleep(config.__retryCount === 1 ? 1500 : 4000)
      return api(config)
    }

    return Promise.reject(normalizeError(error))
  },
)

/**
 * Flattens the backend's error envelope into something a component can render.
 *
 * Every service returns the same shape ({ status, message, fieldErrors }), so the UI
 * needs one branch, not one per endpoint.
 */
export function normalizeError(error) {
  const status = error.response?.status ?? 0
  const data = error.response?.data

  if (!error.response) {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    return {
      status: 0,
      message: offline
        ? 'You appear to be offline. Check your connection and try again.'
        : 'Could not reach the server. It may be starting up — please try again in a moment.',
      fieldErrors: {},
      retryable: true,
    }
  }

  return {
    status,
    message:
      data?.message ||
      (status === 403
        ? 'You do not have permission to do that.'
        : status === 404
          ? 'We could not find what you were looking for.'
          : status >= 500
            ? 'Something went wrong on our side. Please try again.'
            : 'The request could not be completed.'),
    fieldErrors: data?.fieldErrors ?? {},
    retryable: RETRYABLE_STATUSES.includes(status),
  }
}

// ── Endpoints ────────────────────────────────────────────────────────────────────
// Grouped by the service that owns them, which keeps the boundaries visible in the
// client too.

export const authApi = {
  register: (payload) => api.post('/api/auth/register', payload),
  login: (payload) => api.post('/api/auth/login', payload),
  me: () => api.get('/api/auth/me', { __skipAuthRedirect: true }),
}

export const usersApi = {
  list: () => api.get('/api/users'),
  stats: () => api.get('/api/users/stats'),
  updateRole: (id, role) => api.patch(`/api/users/${id}/role`, { role }),
  updateStatus: (id, enabled) => api.patch(`/api/users/${id}/status`, { enabled }),
  remove: (id) => api.delete(`/api/users/${id}`),
}

/** Destinations — the derived city list behind the search autocomplete. */
export const citiesApi = {
  list: (params) => api.get('/api/cities', { params }),
  /** Destinations ranked by distance from a point. Not radius-filtered — see the API docs. */
  nearest: (params) => api.get('/api/cities/nearest', { params }),
}

/** Properties. Reads are public; writes need an ADMIN token. */
export const hotelsApi = {
  list: (params) => api.get('/api/hotels', { params }),
  /** Proximity search. Takes over from the attribute filters rather than combining with them. */
  nearby: (params) => api.get('/api/hotels', { params }),
  get: (id) => api.get(`/api/hotels/${id}`),
  rooms: (id) => api.get(`/api/hotels/${id}/rooms`),
  create: (payload) => api.post('/api/hotels', payload),
  update: (id, payload) => api.put(`/api/hotels/${id}`, payload),
  remove: (id) => api.delete(`/api/hotels/${id}`),
}

export const roomsApi = {
  list: (params) => api.get('/api/rooms', { params }),
  get: (id) => api.get(`/api/rooms/${id}`),
  types: () => api.get('/api/rooms/types'),
  stats: () => api.get('/api/rooms/stats'),
  create: (payload) => api.post('/api/rooms', payload),
  update: (id, payload) => api.put(`/api/rooms/${id}`, payload),
  remove: (id) => api.delete(`/api/rooms/${id}`),
}

export const bookingsApi = {
  /**
   * Hotels in a city that genuinely have rooms free for the dates.
   *
   * Not the same as hotelsApi.list — that one is date-blind and its `priceFrom` may quote a
   * room already taken. This is the endpoint the destination search uses.
   */
  suggestHotels: (params) => api.get('/api/bookings/search/hotels', { params }),

  /** Date-aware room search — the catalog minus anything already reserved. */
  search: (params) => api.get('/api/bookings/search', { params }),
  checkAvailability: (params) => api.get('/api/bookings/availability', { params }),
  create: (payload) => api.post('/api/bookings', payload),
  mine: () => api.get('/api/bookings/my'),
  get: (id) => api.get(`/api/bookings/${id}`),
  cancel: (id) => api.patch(`/api/bookings/${id}/cancel`),
  listAll: (params) => api.get('/api/bookings', { params }),
  stats: (params) => api.get('/api/bookings/stats', { params }),
}
