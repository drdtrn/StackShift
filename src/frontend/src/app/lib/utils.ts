import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind CSS class names safely.
 *
 * Uses `clsx` to conditionally join class strings, then passes the result
 * through `tailwind-merge` to resolve conflicts between Tailwind utilities
 * (e.g. `px-2 px-4` → `px-4`). Always use this instead of bare template
 * literals when composing class names in components.
 *
 * @example
 * cn('px-2 py-1', isActive && 'bg-blue-600', className)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
