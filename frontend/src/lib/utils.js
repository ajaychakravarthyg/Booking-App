import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merges conditional class names, with later Tailwind utilities winning conflicts. */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
