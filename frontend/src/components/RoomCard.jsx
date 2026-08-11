import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BedDouble, ImageOff, Users } from 'lucide-react'
import { Badge } from '@/components/ui/Feedback'
import { buttonClasses } from '@/components/ui/Button'
import { formatMoney, pluralize } from '@/lib/format'
import { cn } from '@/lib/utils'

/*
 * Adapted from "Hotel Card UI Component" by @uniquesonu on 21st.dev
 * https://21st.dev/@uniquesonu/components/hotel-card-ui-component
 *
 * Kept: the hover lift, the image scale-on-hover, the uppercase room-type eyebrow and
 * the muted-foreground metadata row. Changed: laid out vertically for a responsive grid
 * rather than the original's side-by-side card, and the rating/review block replaced
 * with price and capacity, which is what this app actually knows about a room.
 */

const TYPE_BADGE = {
  SUITE: 'primary',
  DELUXE: 'warning',
  DOUBLE: 'default',
  TWIN: 'default',
  SINGLE: 'muted',
}

export function RoomCard({ room, checkIn, checkOut, className }) {
  const [imageFailed, setImageFailed] = useState(false)

  const nights = room.nights ?? null
  const stayTotal = room.totalPrice ?? null
  const detailsHref = {
    pathname: `/rooms/${room.id}`,
    search: checkIn && checkOut ? `?checkIn=${checkIn}&checkOut=${checkOut}` : '',
  }

  return (
    <article
      className={cn(
        'group flex flex-col overflow-hidden rounded-xl border border-border bg-card',
        'shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg',
        className,
      )}
    >
      <Link
        to={detailsHref}
        className="relative block aspect-[4/3] overflow-hidden bg-muted"
        tabIndex={-1}
        aria-hidden="true"
      >
        {room.imageUrl && !imageFailed ? (
          <img
            src={room.imageUrl}
            alt=""
            loading="lazy"
            // A broken remote image would otherwise leave a torn-icon box; swap in a
            // neutral placeholder instead.
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageOff className="h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
          </div>
        )}

        <div className="absolute left-3 top-3">
          <Badge variant={TYPE_BADGE[room.type] ?? 'default'}>{room.typeLabel ?? room.type}</Badge>
        </div>

        {room.available === false && (
          <div className="absolute right-3 top-3">
            <Badge variant="destructive">Out of service</Badge>
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Room {room.roomNumber}
        </p>

        <h3 className="mt-1 text-lg font-semibold leading-snug tracking-tight">
          <Link
            to={detailsHref}
            className="transition-colors hover:text-primary focus-visible:text-primary"
          >
            {room.typeLabel ?? room.type} Room
          </Link>
        </h3>

        {room.description && (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{room.description}</p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-4 w-4" aria-hidden="true" />
            {pluralize(room.capacity, 'guest')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <BedDouble className="h-4 w-4" aria-hidden="true" />
            {room.typeLabel ?? room.type}
          </span>
        </div>

        {room.amenities?.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {room.amenities.slice(0, 3).map((amenity) => (
              <li
                key={amenity}
                className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {amenity}
              </li>
            ))}
            {room.amenities.length > 3 && (
              <li className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                +{room.amenities.length - 3} more
              </li>
            )}
          </ul>
        )}

        {/* mt-auto pins the price row to the bottom so cards of differing text length
            still line up across the grid. */}
        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <div>
            <p className="text-xl font-bold leading-none">
              {formatMoney(room.pricePerNight)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">/ night</span>
            </p>
            {nights > 0 && stayTotal != null && (
              <p className="mt-1 text-xs text-muted-foreground">
                {formatMoney(stayTotal)} total · {pluralize(nights, 'night')}
              </p>
            )}
          </div>

          <Link to={detailsHref} className={buttonClasses({ size: 'sm', className: 'shrink-0' })}>
            View
          </Link>
        </div>
      </div>
    </article>
  )
}
