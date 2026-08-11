import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ImageOff, MapPin, Star, Users } from 'lucide-react'
import { Badge } from '@/components/ui/Feedback'
import { buttonClasses } from '@/components/ui/Button'
import { formatMoney, pluralize } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Filled stars up to the rating, hollow after. Falls back to nothing when unrated. */
function StarRating({ rating }) {
  if (!rating) return null
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} star hotel`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={cn(
            'h-3.5 w-3.5',
            index < rating ? 'fill-warning text-warning' : 'text-muted-foreground/40',
          )}
          aria-hidden="true"
        />
      ))}
    </span>
  )
}

/**
 * A suggested property in a destination result list.
 *
 * <p>Shows the cheapest *available* rate rather than the property's headline price, and
 * pairs `availableRooms` with `totalRooms` so scarcity is legible — "1 of 12 left" reads very
 * differently from "12 of 12".
 */
export function HotelCard({ hotel, checkIn, checkOut, guests, className }) {
  const [imageFailed, setImageFailed] = useState(false)

  const params = new URLSearchParams()
  if (checkIn) params.set('checkIn', checkIn)
  if (checkOut) params.set('checkOut', checkOut)
  if (guests) params.set('guests', guests)
  const href = { pathname: `/hotels/${hotel.hotelId ?? hotel.id}`, search: params.toString() }

  const available = hotel.availableRooms
  const total = hotel.totalRooms
  // Only warn when it is genuinely scarce; "3 of 4" is not worth alarming anyone about.
  const scarce = available != null && available <= 2

  return (
    <article
      className={cn(
        'group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm',
        'transition-all duration-300 hover:-translate-y-1 hover:shadow-lg sm:flex-row',
        className,
      )}
    >
      <Link
        to={href}
        tabIndex={-1}
        aria-hidden="true"
        className="relative block h-48 shrink-0 overflow-hidden bg-muted sm:h-auto sm:w-64 lg:w-72"
      >
        {hotel.imageUrl && !imageFailed ? (
          <img
            src={hotel.imageUrl}
            alt=""
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageOff className="h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <StarRating rating={hotel.starRating} />
          {scarce && <Badge variant="warning">Only {pluralize(available, 'room')} left</Badge>}
        </div>

        <h3 className="mt-1.5 text-lg font-semibold leading-snug tracking-tight">
          <Link to={href} className="transition-colors hover:text-primary focus-visible:text-primary">
            {hotel.name}
          </Link>
        </h3>

        <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
          {hotel.city}
          {hotel.country ? `, ${hotel.country}` : ''}
        </p>

        {hotel.description && (
          <p className="mt-2.5 line-clamp-2 text-sm text-muted-foreground">{hotel.description}</p>
        )}

        {hotel.amenities?.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {hotel.amenities.slice(0, 4).map((amenity) => (
              <li
                key={amenity}
                className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {amenity}
              </li>
            ))}
            {hotel.amenities.length > 4 && (
              <li className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                +{hotel.amenities.length - 4}
              </li>
            )}
          </ul>
        )}

        {/* mt-auto pins the price row down so cards line up despite differing text length. */}
        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-5">
          <div className="text-sm text-muted-foreground">
            {available != null && total != null && (
              <p>
                <span className="font-medium text-foreground">{available}</span> of {total} rooms
                free
              </p>
            )}
            {hotel.maxCapacity && (
              <p className="mt-0.5 inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                sleeps up to {hotel.maxCapacity}
              </p>
            )}
          </div>

          <div className="text-right">
            <p className="text-xs text-muted-foreground">from</p>
            <p className="text-xl font-bold leading-none">
              {formatMoney(hotel.cheapestPricePerNight ?? hotel.priceFrom)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">/ night</span>
            </p>
            {hotel.cheapestStayTotal != null && hotel.nights ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {formatMoney(hotel.cheapestStayTotal)} for {pluralize(hotel.nights, 'night')}
              </p>
            ) : null}
            <Link to={href} className={buttonClasses({ size: 'sm', className: 'mt-2.5' })}>
              See rooms
            </Link>
          </div>
        </div>
      </div>
    </article>
  )
}
