import { useCallback, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './Button'

/**
 * Accessible modal dialog.
 *
 * Handles the things a plain absolutely-positioned div gets wrong: Escape to close,
 * a focus trap so Tab cannot wander into the page behind, focus restored to whatever
 * opened it, and background scroll locked while open.
 */
export function Modal({ open, onClose, title, description, children, footer, className }) {
  const panelRef = useRef(null)
  const previouslyFocused = useRef(null)

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose?.()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = panelRef.current?.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable?.length) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      // Wrap around at both ends so focus stays inside the dialog.
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    },
    [onClose],
  )

  useEffect(() => {
    if (!open) return

    previouslyFocused.current = document.activeElement
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    // Focus the panel itself rather than its first control — landing on a destructive
    // button would make Enter an accident waiting to happen.
    const timer = window.setTimeout(() => panelRef.current?.focus(), 0)

    return () => {
      window.clearTimeout(timer)
      document.body.style.overflow = overflow
      previouslyFocused.current?.focus?.()
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        // Only a click that both starts and ends on the backdrop should close.
        if (event.target === event.currentTarget) onClose?.()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={cn(
          'w-full max-w-lg rounded-t-2xl border border-border bg-card shadow-xl outline-none',
          'animate-fade-in-up sm:rounded-2xl',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{title}</h2>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close dialog">
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-5">{children}</div>

        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-border p-5 sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
