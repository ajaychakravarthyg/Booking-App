import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

/* Adapted from the shadcn/ui Card in the 21st.dev registry (TSX → JSX). */

export const Card = forwardRef(function Card({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-xl border border-border bg-card text-card-foreground shadow-sm',
        className,
      )}
      {...props}
    />
  )
})

export const CardHeader = forwardRef(function CardHeader({ className, ...props }, ref) {
  return <div ref={ref} className={cn('flex flex-col gap-1.5 p-5 sm:p-6', className)} {...props} />
})

export const CardTitle = forwardRef(function CardTitle({ className, ...props }, ref) {
  return (
    <h3
      ref={ref}
      className={cn('text-lg font-semibold leading-tight tracking-tight', className)}
      {...props}
    />
  )
})

export const CardDescription = forwardRef(function CardDescription({ className, ...props }, ref) {
  return <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
})

export const CardContent = forwardRef(function CardContent({ className, ...props }, ref) {
  return <div ref={ref} className={cn('p-5 pt-0 sm:p-6 sm:pt-0', className)} {...props} />
})

export const CardFooter = forwardRef(function CardFooter({ className, ...props }, ref) {
  return (
    <div ref={ref} className={cn('flex items-center p-5 pt-0 sm:p-6 sm:pt-0', className)} {...props} />
  )
})
