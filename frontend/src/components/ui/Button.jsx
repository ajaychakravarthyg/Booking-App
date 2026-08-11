import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/*
 * Adapted from the shadcn/ui Button that ships with the 21st.dev registry.
 * Converted to JSX and the variant map inlined, so the project does not need
 * class-variance-authority for one component.
 */

const base =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ' +
  'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
  'disabled:pointer-events-none disabled:opacity-50 select-none'

const variants = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm',
  outline: 'border border-border bg-card hover:bg-accent hover:text-accent-foreground',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
  link: 'text-primary underline-offset-4 hover:underline',
}

const sizes = {
  sm: 'h-9 rounded-md px-3 text-sm',
  default: 'h-10 px-4 py-2',
  lg: 'h-11 rounded-md px-6 text-base',
  icon: 'h-10 w-10',
}

/**
 * The button's classes without the button element.
 *
 * Used for react-router `<Link>`s that should look like buttons. The shadcn original
 * solves this with Radix's `asChild`/Slot; exporting the class string keeps the same
 * capability without pulling in @radix-ui/react-slot for a single use.
 */
export function buttonClasses({ variant = 'default', size = 'default', className } = {}) {
  return cn(base, variants[variant], sizes[size], className)
}

export const Button = forwardRef(function Button(
  { className, variant = 'default', size = 'default', loading = false, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      // Prevents the double-submit that creates two bookings from one impatient click.
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
})
