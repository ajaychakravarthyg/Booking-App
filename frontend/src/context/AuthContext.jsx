import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  TOKEN_KEY,
  USER_KEY,
  authApi,
  getStoredToken,
  normalizeError,
  setUnauthorizedHandler,
} from '@/lib/api'

const AuthContext = createContext(null)

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    // Corrupt JSON or private-mode storage — treat as signed out rather than crashing.
    return null
  }
}

export function AuthProvider({ children }) {
  // Seeded from localStorage so a refresh does not flash the logged-out navbar.
  const [user, setUser] = useState(readStoredUser)
  const [token, setToken] = useState(getStoredToken)
  const [initializing, setInitializing] = useState(Boolean(getStoredToken()))

  const persist = useCallback((nextToken, nextUser) => {
    try {
      if (nextToken) localStorage.setItem(TOKEN_KEY, nextToken)
      else localStorage.removeItem(TOKEN_KEY)

      if (nextUser) localStorage.setItem(USER_KEY, JSON.stringify(nextUser))
      else localStorage.removeItem(USER_KEY)
    } catch {
      // Storage unavailable — the session simply won't survive a reload.
    }
    setToken(nextToken ?? null)
    setUser(nextUser ?? null)
  }, [])

  const logout = useCallback(() => persist(null, null), [persist])

  // Let the axios interceptor drop the session when the API rejects the token.
  useEffect(() => {
    setUnauthorizedHandler(() => persist(null, null))
    return () => setUnauthorizedHandler(null)
  }, [persist])

  /*
   * Revalidate a stored token once on mount.
   *
   * The cached user object could be stale in a way that matters — an admin may have
   * demoted this account since the token was issued, and trusting the cached role would
   * render admin navigation that then 403s. /api/auth/me re-reads the database.
   */
  useEffect(() => {
    if (!getStoredToken()) {
      setInitializing(false)
      return
    }
    let cancelled = false

    authApi
      .me()
      .then(({ data }) => {
        if (!cancelled) {
          try {
            localStorage.setItem(USER_KEY, JSON.stringify(data))
          } catch {
            /* ignore */
          }
          setUser(data)
        }
      })
      .catch((error) => {
        if (cancelled) return
        const status = error.response?.status ?? normalizeError(error).status
        // Only sign out when the token is genuinely rejected. A 503 from a cold-starting
        // backend must not log the user out.
        if (status === 401 || status === 403) {
          persist(null, null)
        }
      })
      .finally(() => {
        if (!cancelled) setInitializing(false)
      })

    return () => {
      cancelled = true
    }
  }, [persist])

  const login = useCallback(
    async (credentials) => {
      const { data } = await authApi.login(credentials)
      persist(data.token, data.user)
      return data.user
    },
    [persist],
  )

  const register = useCallback(
    async (payload) => {
      const { data } = await authApi.register(payload)
      persist(data.token, data.user)
      return data.user
    },
    [persist],
  )

  const value = useMemo(
    () => ({
      user,
      token,
      initializing,
      isAuthenticated: Boolean(token && user),
      isAdmin: user?.role === 'ADMIN',
      login,
      register,
      logout,
    }),
    [user, token, initializing, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside an <AuthProvider>')
  }
  return context
}
