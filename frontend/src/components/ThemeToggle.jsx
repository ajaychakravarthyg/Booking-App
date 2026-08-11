import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/Button'

/*
 * Adapted from the ThemeToggle bundled with the 21st.dev Hotel Card component, which
 * used next-themes. This is a Vite SPA, so it toggles the `dark` class directly and
 * persists to localStorage — the pre-paint script in index.html applies it on load to
 * avoid a flash of the wrong theme.
 */
export function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    try {
      localStorage.setItem('theme', isDark ? 'dark' : 'light')
    } catch {
      /* private mode — the choice just won't persist */
    }
  }, [isDark])

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setIsDark((value) => !value)}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {isDark ? (
        <Sun className="h-[1.15rem] w-[1.15rem]" aria-hidden="true" />
      ) : (
        <Moon className="h-[1.15rem] w-[1.15rem]" aria-hidden="true" />
      )}
    </Button>
  )
}
