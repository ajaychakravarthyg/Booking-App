import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

export function StatCard({ label, value, hint, icon: Icon, tone = 'primary', className }) {
  const tones = {
    primary: 'bg-primary/12 text-primary',
    success: 'bg-success/12 text-success',
    warning: 'bg-warning/15 text-warning',
    destructive: 'bg-destructive/12 text-destructive',
    muted: 'bg-muted text-muted-foreground',
  }

  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-1.5 text-2xl font-bold leading-none tracking-tight">{value}</p>
          {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-lg', tones[tone])}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        )}
      </div>
    </Card>
  )
}
