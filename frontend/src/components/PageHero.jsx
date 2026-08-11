import { cn } from '@/lib/utils'

/**
 * Wide image banner with a gradient scrim and overlaid text.
 *
 * The scrim is not decoration — white text directly on a photograph has unpredictable
 * contrast, and a dark gradient guarantees the heading stays legible whatever the image
 * happens to be. `aria-hidden` on the image plus real heading markup underneath keeps it
 * a heading to a screen reader, not a picture.
 */
export function PageHero({ image, eyebrow, title, description, children, className, height = 'h-48 sm:h-56' }) {
  return (
    <section
      className={cn(
        'relative isolate overflow-hidden rounded-xl border border-border bg-muted',
        height,
        className,
      )}
    >
      <img
        src={image}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Left-weighted scrim so the text side is always dark enough to read on. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/20"
      />

      <div className="relative flex h-full flex-col justify-center gap-1.5 p-5 sm:p-7">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-widest text-white/70">{eyebrow}</p>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
        {description && (
          <p className="max-w-2xl text-sm text-white/85 sm:text-base">{description}</p>
        )}
        {children}
      </div>
    </section>
  )
}

/** Shorter variant for the banners above admin panels. */
export function PanelHero({ image, title, description, action }) {
  return (
    <section className="relative isolate mb-5 overflow-hidden rounded-xl border border-border bg-muted">
      <img
        src={image}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/25"
      />
      <div className="relative flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-white/80">{description}</p>}
        </div>
        {action}
      </div>
    </section>
  )
}
