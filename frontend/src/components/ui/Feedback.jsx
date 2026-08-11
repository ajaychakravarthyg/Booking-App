import { AlertCircle, CheckCircle2, Info, Loader2, RefreshCw, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './Button'

const alertStyles = {
  error: {
    wrapper: 'border-destructive/40 bg-destructive/10 text-destructive',
    Icon: AlertCircle,
    role: 'alert',
  },
  success: {
    wrapper: 'border-success/40 bg-success/10 text-success',
    Icon: CheckCircle2,
    role: 'status',
  },
  warning: {
    wrapper: 'border-warning/40 bg-warning/10 text-warning',
    Icon: TriangleAlert,
    role: 'status',
  },
  info: {
    wrapper: 'border-primary/40 bg-primary/10 text-primary',
    Icon: Info,
    role: 'status',
  },
}

export function Alert({ variant = 'info', title, children, onRetry, className }) {
  const { wrapper, Icon, role } = alertStyles[variant] ?? alertStyles.info

  return (
    <div
      role={role}
      // Announced by screen readers as soon as it appears, so a failed submit is not
      // silent for non-visual users.
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      className={cn('flex items-start gap-3 rounded-lg border p-3.5 text-sm', wrapper, className)}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', 'text-foreground/80')}>{children}</div>}
        {onRetry && (
          <Button variant="outline" size="sm" className="mt-2.5" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Try again
          </Button>
        )}
      </div>
    </div>
  )
}

export function Spinner({ className, label = 'Loading' }) {
  return (
    <span role="status" aria-label={label}>
      <Loader2 className={cn('h-5 w-5 animate-spin text-muted-foreground', className)} />
    </span>
  )
}

export function PageLoader({ label = 'Loading' }) {
  return (
    <div className="flex min-h-[45vh] flex-col items-center justify-center gap-3">
      <Spinner className="h-7 w-7" label={label} />
      <p className="text-sm text-muted-foreground">{label}…</p>
    </div>
  )
}

export function Skeleton({ className }) {
  return (
    <div
      aria-hidden="true"
      className={cn('relative overflow-hidden rounded-md bg-muted skeleton-shimmer', className)}
    />
  )
}

/** Mirrors the RoomCard layout so the grid does not reflow when data lands. */
export function RoomCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-14 text-center',
        className,
      )}
    >
      {Icon && (
        <div className="mb-4 rounded-full bg-muted p-3.5">
          <Icon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        </div>
      )}
      <h3 className="text-base font-semibold">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Badge({ variant = 'default', className, children }) {
  const variants = {
    default: 'bg-secondary text-secondary-foreground border-border',
    primary: 'bg-primary/12 text-primary border-primary/25',
    success: 'bg-success/12 text-success border-success/25',
    destructive: 'bg-destructive/12 text-destructive border-destructive/25',
    warning: 'bg-warning/15 text-warning border-warning/30',
    muted: 'bg-muted text-muted-foreground border-border',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
