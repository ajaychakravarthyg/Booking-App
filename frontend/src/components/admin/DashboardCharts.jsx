import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/Feedback'
import { BarChart3, TrendingUp } from 'lucide-react'
import { formatChartDate, formatMoney } from '@/lib/format'

/*
 * Colours come from the theme's --chart-* tokens rather than hard-coded hexes, so the
 * charts re-theme with the rest of the app when dark mode flips — including the lifted
 * dark-mode values, since the published theme's chart colours were near-black.
 */
const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

const axisStyle = { fontSize: 11, fill: 'var(--muted-foreground)' }

function ChartTooltip({ active, payload, label, valueFormatter }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-popover-foreground">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="mt-0.5 text-sm font-semibold" style={{ color: entry.color }}>
          {valueFormatter ? valueFormatter(entry.value, entry) : entry.value}
        </p>
      ))}
    </div>
  )
}

/** Confirmed arrivals per check-in date. The API pads empty days with zeros so the
 *  time axis stays continuous rather than compressing quiet stretches. */
export function ArrivalsChart({ data }) {
  const points = (data ?? []).map((point) => ({
    ...point,
    label: formatChartDate(point.date),
    revenueNumber: Number(point.revenue),
  }))
  const hasAny = points.some((point) => point.bookings > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" aria-hidden="true" />
          Arrivals over time
        </CardTitle>
        <CardDescription>
          Confirmed check-ins per day, from 15 days ago to 30 days ahead.
        </CardDescription>
      </CardHeader>

      <div className="px-2 pb-5 sm:px-4">
        {hasAny ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="arrivalsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={axisStyle}
                  stroke="var(--border)"
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis tick={axisStyle} stroke="var(--border)" allowDecimals={false} width={40} />
                <Tooltip
                  content={
                    <ChartTooltip
                      valueFormatter={(value) => `${value} ${value === 1 ? 'arrival' : 'arrivals'}`}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="bookings"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#arrivalsFill)"
                  // Dots on a 46-point series turn into visual noise.
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="px-3 pb-2">
            <EmptyState
              icon={TrendingUp}
              title="No arrivals in this window"
              description="Once guests book stays in the next 30 days, the trend appears here."
            />
          </div>
        )}
      </div>
    </Card>
  )
}

/** Catalog composition — how the inventory splits across room types. */
export function RoomTypeChart({ data }) {
  const points = (data ?? []).map((entry) => ({
    name: entry.label ?? entry.type,
    count: entry.count,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" aria-hidden="true" />
          Rooms by type
        </CardTitle>
        <CardDescription>How the inventory is distributed across room types.</CardDescription>
      </CardHeader>

      <div className="px-2 pb-5 sm:px-4">
        {points.length > 0 ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={points} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={axisStyle} stroke="var(--border)" />
                <YAxis tick={axisStyle} stroke="var(--border)" allowDecimals={false} width={40} />
                <Tooltip
                  cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                  content={
                    <ChartTooltip
                      valueFormatter={(value) => `${value} ${value === 1 ? 'room' : 'rooms'}`}
                    />
                  }
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={56}>
                  {points.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="px-3 pb-2">
            <EmptyState icon={BarChart3} title="No rooms in the catalog yet" />
          </div>
        )}
      </div>
    </Card>
  )
}

/** Revenue per arrival date, kept separate so each chart answers one question. */
export function RevenueChart({ data }) {
  const points = (data ?? []).map((point) => ({
    label: formatChartDate(point.date),
    revenue: Number(point.revenue),
  }))
  const hasAny = points.some((point) => point.revenue > 0)

  if (!hasAny) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue by arrival date</CardTitle>
        <CardDescription>Total confirmed booking value, grouped by check-in day.</CardDescription>
      </CardHeader>

      <div className="px-2 pb-5 sm:px-4">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points} margin={{ top: 5, right: 10, left: -6, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={axisStyle}
                stroke="var(--border)"
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                tick={axisStyle}
                stroke="var(--border)"
                width={58}
                tickFormatter={(value) => `$${value >= 1000 ? `${Math.round(value / 1000)}k` : value}`}
              />
              <Tooltip
                cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                content={<ChartTooltip valueFormatter={(value) => formatMoney(value)} />}
              />
              <Bar dataKey="revenue" fill="var(--chart-2)" radius={[5, 5, 0, 0]} maxBarSize={38} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  )
}
