import { forwardRef, useId } from 'react'
import { cn } from '@/lib/utils'

const controlBase =
  'w-full rounded-md border bg-input px-3 py-2 text-sm text-foreground shadow-sm ' +
  'placeholder:text-muted-foreground transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ' +
  'focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60'

export const Label = forwardRef(function Label({ className, required, children, ...props }, ref) {
  return (
    <label
      ref={ref}
      className={cn('text-sm font-medium leading-none text-foreground', className)}
      {...props}
    >
      {children}
      {required && (
        <span className="ml-0.5 text-destructive" aria-hidden="true">
          *
        </span>
      )}
    </label>
  )
})

export const Input = forwardRef(function Input({ className, error, ...props }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={error ? true : undefined}
      className={cn(
        controlBase,
        // Red border alone would be invisible to colour-blind users, so the field
        // error text below always carries the same information.
        error ? 'border-destructive focus-visible:ring-destructive' : 'border-border',
        className,
      )}
      {...props}
    />
  )
})

export const Select = forwardRef(function Select({ className, error, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      aria-invalid={error ? true : undefined}
      className={cn(
        controlBase,
        'cursor-pointer appearance-none bg-no-repeat pr-9',
        error ? 'border-destructive focus-visible:ring-destructive' : 'border-border',
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundPosition: 'right 0.65rem center',
      }}
      {...props}
    >
      {children}
    </select>
  )
})

export const Textarea = forwardRef(function Textarea({ className, error, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      aria-invalid={error ? true : undefined}
      className={cn(
        controlBase,
        'min-h-20 resize-y',
        error ? 'border-destructive focus-visible:ring-destructive' : 'border-border',
        className,
      )}
      {...props}
    />
  )
})

/**
 * Label + control + error message, wired together.
 *
 * The generated id links the label to the control and the error to both via
 * aria-describedby, so a screen reader announces the problem when focus lands on the
 * field rather than leaving the user to hunt for it.
 */
export function Field({ label, error, hint, required, children, className }) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <Label htmlFor={id} required={required}>
          {label}
        </Label>
      )}
      {children({
        id,
        error: Boolean(error),
        'aria-describedby': error ? errorId : hint ? hintId : undefined,
      })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
