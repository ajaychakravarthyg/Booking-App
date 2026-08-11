import { useState } from 'react'
import { BedDouble } from 'lucide-react'
import { thumbnail } from '@/lib/images'
import { cn } from '@/lib/utils'

/**
 * Small square room image for table rows and compact lists.
 *
 * Falls back to an icon tile rather than a broken-image glyph, because room images are
 * arbitrary admin-supplied URLs that can rot at any time.
 */
export function RoomThumb({ imageUrl, roomNumber, size = 40, className }) {
  const [failed, setFailed] = useState(false)
  const src = thumbnail(imageUrl, size * 2) // 2× for crisp rendering on retina

  return (
    <span
      className={cn(
        'relative grid shrink-0 place-items-center overflow-hidden rounded-md bg-muted',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          width={size}
          height={size}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <BedDouble
          className="text-muted-foreground/60"
          style={{ width: size * 0.45, height: size * 0.45 }}
          aria-hidden="true"
        />
      )}
      <span className="sr-only">Room {roomNumber}</span>
    </span>
  )
}
